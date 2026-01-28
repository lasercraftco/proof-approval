import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { proofUploadMetaSchema, validateFile, MAX_FILES_PER_UPLOAD, formatZodErrors } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Rate limit uploads
  const rateLimitResponse = rateLimit(request, 'proofs-upload', RATE_LIMITS.upload);
  if (rateLimitResponse) return rateLimitResponse;

  let createdVersionId: string | null = null;
  const uploadedFilePaths: string[] = [];

  try {
    const formData = await request.formData();
    const orderId = formData.get('orderId') as string;
    const staffNote = formData.get('staffNote') as string;
    const files = formData.getAll('files') as File[];

    // Validate metadata
    const metaResult = proofUploadMetaSchema.safeParse({ orderId, staffNote });
    if (!metaResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(metaResult.error) },
        { status: 400 }
      );
    }

    // Check file count
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_FILES_PER_UPLOAD} files per upload.` },
        { status: 400 }
      );
    }

    // Validate all files before uploading any
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    // Verify order exists
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get current version number
    const { data: versions } = await supabaseAdmin
      .from('proof_versions')
      .select('version_number')
      .eq('order_id', orderId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (versions?.[0]?.version_number || 0) + 1;

    // Create new version
    const { data: version, error: versionError } = await supabaseAdmin
      .from('proof_versions')
      .insert({
        order_id: orderId,
        version_number: nextVersion,
        staff_note: staffNote || null,
      })
      .select()
      .single();

    if (versionError || !version) {
      console.error('Error creating proof version:', versionError);
      return NextResponse.json({ error: 'Failed to create proof version' }, { status: 500 });
    }

    createdVersionId = version.id;

    // Upload files
    const uploadedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      const fileName = `${orderId}/${version.id}/${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      // Upload to storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('proofs')
        .upload(fileName, buffer, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        // Rollback: delete version and any successfully uploaded files
        if (createdVersionId) {
          await rollbackUpload(createdVersionId, uploadedFilePaths);
        }
        return NextResponse.json(
          { error: `Failed to upload file: ${file.name}` },
          { status: 500 }
        );
      }

      uploadedFilePaths.push(fileName);

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('proofs')
        .getPublicUrl(fileName);

      // Create file record
      const { data: fileRecord, error: fileError } = await supabaseAdmin
        .from('proof_files')
        .insert({
          version_id: version.id,
          original_path: urlData.publicUrl,
          preview_path: urlData.publicUrl,
          filename: file.name,
          mime_type: file.type,
          sort_order: i,
        })
        .select()
        .single();

      if (fileError) {
        console.error('File record error:', fileError);
        if (createdVersionId) {
          await rollbackUpload(createdVersionId, uploadedFilePaths);
        }
        return NextResponse.json(
          { error: 'Failed to save file record' },
          { status: 500 }
        );
      }

      uploadedFiles.push(fileRecord);
    }

    // Update order status if draft
    await supabaseAdmin
      .from('orders')
      .update({ status: 'open' })
      .eq('id', orderId)
      .eq('status', 'draft');

    return NextResponse.json({
      version,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Proof upload error:', error);
    // Attempt rollback on unexpected error
    if (createdVersionId) {
      await rollbackUpload(createdVersionId, uploadedFilePaths);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Rollback function to clean up on failure
 */
async function rollbackUpload(versionId: string, filePaths: string[]) {
  try {
    // Delete uploaded files from storage
    if (filePaths.length > 0) {
      await supabaseAdmin.storage.from('proofs').remove(filePaths);
    }

    // Delete version (cascades to proof_files)
    await supabaseAdmin
      .from('proof_versions')
      .delete()
      .eq('id', versionId);
  } catch (rollbackError) {
    console.error('Rollback error:', rollbackError);
    // Log but don't throw - original error is more important
  }
}
