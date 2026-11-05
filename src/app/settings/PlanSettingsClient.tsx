'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PlanOption = {
  id: string;
  name: string;
  description: string;
  available: boolean;
  feePercent: number;
};

type FeeSummary = { orders: number; sales: number; fees: number };

const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function PlanSettingsClient({
  currentPlan,
  plans,
  feeSummary,
}: {
  currentPlan: string;
  plans: PlanOption[];
  feeSummary: FeeSummary;
}) {
  const [selected, setSelected] = useState(currentPlan);
  const [saving, setSaving] = useState(false);

  const choosePlan = async (plan: string) => {
    if (plan === selected || saving) return;
    const previous = selected;
    setSelected(plan);
    setSaving(true);
    try {
      const res = await fetch('/api/settings/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Plan updated. Your checkout will change within a few minutes.');
    } catch {
      setSelected(previous);
      toast.error('Could not change your plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Your plan</CardTitle>
          <CardDescription>Choose what customers see when they check out.</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset disabled={saving} className="space-y-3">
            <legend className="sr-only">Checkout plan</legend>
            {plans.map((plan) => (
              <label
                key={plan.id}
                className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                  selected === plan.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                } ${plan.available ? 'cursor-pointer hover:border-slate-400' : 'opacity-60 cursor-not-allowed'}`}
              >
                <input
                  type="radio"
                  name="checkout-plan"
                  className="mt-1 accent-slate-900"
                  checked={selected === plan.id}
                  disabled={!plan.available}
                  onChange={() => choosePlan(plan.id)}
                />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {plan.name}
                    {!plan.available && (
                      <span className="px-2 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">Coming soon</span>
                    )}
                  </span>
                  <span className="block mt-1 text-sm text-slate-500">{plan.description}</span>
                  {plan.available && (
                    <span className="block mt-1 text-sm font-medium text-slate-700">
                      {plan.feePercent > 0 ? `${plan.feePercent}% fee per order` : 'Fee not set'}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Fees this month</CardTitle>
          <CardDescription>Based on orders completed in Shopify. Cancelled and returned orders are not deducted yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-slate-500">Orders</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{feeSummary.orders.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Order value</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{money(feeSummary.sales)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Fees</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{money(feeSummary.fees)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
