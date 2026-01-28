export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-24 bg-gray-200 rounded"></div>
          <div className="h-4 w-32 bg-gray-100 rounded mt-2"></div>
        </div>
        <div className="h-9 w-28 bg-gray-200 rounded"></div>
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 w-48 bg-gray-200 rounded"></div>
        <div className="h-9 w-36 bg-gray-200 rounded"></div>
      </div>

      {/* Quick filters skeleton */}
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-7 w-20 bg-gray-100 rounded-full"></div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-10 bg-gray-50 border-b border-gray-200"></div>
        <div className="divide-y divide-gray-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 flex items-center px-4 gap-4">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                <div className="h-3 w-32 bg-gray-100 rounded"></div>
              </div>
              <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
