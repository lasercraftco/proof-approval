'use client';

import { useState, useEffect } from 'react';

type OrderCosts = {
  id: string;
  order_id: string;
  order_revenue: number | null;
  labor_cost: number;
  material_cost: number;
  shipping_cost: number;
  other_cost: number;
  total_cost: number;
  gross_profit: number;
  profit_margin: number;
  labor_minutes: number;
};

type Props = {
  orderId: string;
  orderTotal: number | null;
  initialCosts?: OrderCosts | null;
};

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatDuration(minutes: number): string {
  if (!minutes) return '0m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function JobCostingCard({ orderId, orderTotal, initialCosts }: Props) {
  const [costs, setCosts] = useState<OrderCosts | null>(initialCosts || null);
  const [loading, setLoading] = useState(!initialCosts);
  const [calculating, setCalculating] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [additionalCost, setAdditionalCost] = useState({ type: 'shipping_cost', amount: '' });

  useEffect(() => {
    if (!initialCosts) {
      fetchCosts();
    }
  }, [orderId]);

  const fetchCosts = async () => {
    try {
      const response = await fetch(`/api/job-costing/${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setCosts(data.costs);
      }
    } catch (error) {
      console.error('Failed to fetch costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setCalculating(true);
    try {
      const response = await fetch(`/api/job-costing/${orderId}/calculate`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setCosts(data.costs);
      }
    } catch (error) {
      console.error('Failed to calculate costs:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleAddCost = async () => {
    const amount = parseFloat(additionalCost.amount);
    if (!amount) return;

    try {
      const response = await fetch(`/api/job-costing/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [additionalCost.type]: amount }),
      });
      if (response.ok) {
        const data = await response.json();
        setCosts(data.costs);
        setShowAddCost(false);
        setAdditionalCost({ type: 'shipping_cost', amount: '' });
      }
    } catch (error) {
      console.error('Failed to add cost:', error);
    }
  };

  const profitColor = (costs?.gross_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600';
  const marginColor = (costs?.profit_margin || 0) >= 30 ? 'text-green-600' : 
                      (costs?.profit_margin || 0) >= 15 ? 'text-amber-600' : 'text-red-600';

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Job Costing</h3>
        <button
          onClick={handleRecalculate}
          disabled={calculating}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
        >
          {calculating ? 'Calculating...' : '↻ Recalculate'}
        </button>
      </div>

      <div className="p-6">
        {/* Profit Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-1">Revenue</div>
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(costs?.order_revenue || orderTotal)}
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-1">Profit</div>
            <div className={`text-xl font-bold ${profitColor}`}>
              {formatCurrency(costs?.gross_profit || 0)}
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-1">Margin</div>
            <div className={`text-xl font-bold ${marginColor}`}>
              {costs?.profit_margin?.toFixed(1) || 0}%
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱️</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Labor</div>
                <div className="text-xs text-gray-500">{formatDuration(costs?.labor_minutes || 0)}</div>
              </div>
            </div>
            <div className="text-sm font-medium text-gray-900">
              {formatCurrency(costs?.labor_cost || 0)}
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Materials</div>
              </div>
            </div>
            <div className="text-sm font-medium text-gray-900">
              {formatCurrency(costs?.material_cost || 0)}
            </div>
          </div>

          {(costs?.shipping_cost || 0) > 0 && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚚</span>
                <div>
                  <div className="text-sm font-medium text-gray-900">Shipping</div>
                </div>
              </div>
              <div className="text-sm font-medium text-gray-900">
                {formatCurrency(costs?.shipping_cost || 0)}
              </div>
            </div>
          )}

          {(costs?.other_cost || 0) > 0 && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <div>
                  <div className="text-sm font-medium text-gray-900">Other</div>
                </div>
              </div>
              <div className="text-sm font-medium text-gray-900">
                {formatCurrency(costs?.other_cost || 0)}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between py-2 border-t pt-3">
            <div className="text-sm font-semibold text-gray-900">Total Cost</div>
            <div className="text-sm font-bold text-gray-900">
              {formatCurrency(costs?.total_cost || 0)}
            </div>
          </div>
        </div>

        {/* Add Cost Button */}
        {!showAddCost ? (
          <button
            onClick={() => setShowAddCost(true)}
            className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-dashed"
          >
            + Add Shipping/Other Cost
          </button>
        ) : (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex gap-3">
              <select
                value={additionalCost.type}
                onChange={(e) => setAdditionalCost({ ...additionalCost, type: e.target.value })}
                className="px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="shipping_cost">Shipping</option>
                <option value="other_cost">Other</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={additionalCost.amount}
                onChange={(e) => setAdditionalCost({ ...additionalCost, amount: e.target.value })}
                placeholder="0.00"
                className="flex-1 px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddCost}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddCost(false)}
                className="px-3 py-2 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
