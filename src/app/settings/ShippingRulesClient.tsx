'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Rule = {
  id: string;
  name: string;
  fee: number;
  minCart: number;
  maxCart: number | null;
  states: string[];
  pincodes: string[];
  paymentMethods: string[];
  isActive: boolean;
};

const METHODS = ['COD', 'PREPAID', 'PARTIAL COD'];
const METHOD_NAMES: Record<string, string> = { COD: 'COD', PREPAID: 'Prepaid', 'PARTIAL COD': 'Partial COD' };
const EMPTY = { id: '', name: '', fee: '0', minCart: '0', maxCart: '', states: '', pincodes: '', paymentMethods: [] as string[], isActive: true };
const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function ShippingRulesClient({ initialRules }: { initialRules: Rule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, id: form.id || undefined, states: splitList(form.states), pincodes: splitList(form.pincodes) };
      const res = await fetch('/api/settings/shipping-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const saved: Rule = {
        id: data.id,
        name: form.name.trim(),
        fee: Number(form.fee),
        minCart: Number(form.minCart || 0),
        maxCart: form.maxCart === '' ? null : Number(form.maxCart),
        states: payload.states,
        pincodes: payload.pincodes,
        paymentMethods: form.paymentMethods,
        isActive: form.isActive,
      };
      setRules((current) => (form.id ? current.map((rule) => (rule.id === form.id ? saved : rule)) : [...current, saved]));
      setForm(EMPTY);
      setEditing(false);
      toast.success('Shipping rule saved.');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not save this rule.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rule: Rule) => {
    const res = await fetch('/api/settings/shipping-rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id }),
    });
    if (!res.ok) {
      toast.error('Could not delete this rule.');
      return;
    }
    setRules((current) => current.filter((item) => item.id !== rule.id));
    toast.success('Shipping rule deleted.');
  };

  const edit = (rule: Rule) => {
    setForm({
      id: rule.id,
      name: rule.name,
      fee: String(rule.fee),
      minCart: String(rule.minCart),
      maxCart: rule.maxCart === null ? '' : String(rule.maxCart),
      states: rule.states.join(', '),
      pincodes: rule.pincodes.join(', '),
      paymentMethods: rule.paymentMethods,
      isActive: rule.isActive,
    });
    setEditing(true);
  };

  const summary = (rule: Rule) => [
    rule.maxCart === null ? `Cart from ₹${rule.minCart}` : `Cart ₹${rule.minCart} to ₹${rule.maxCart}`,
    rule.states.length > 0 ? rule.states.join(', ') : null,
    rule.pincodes.length > 0 ? `Pincodes ${rule.pincodes.join(', ')}` : null,
    rule.paymentMethods.length > 0 ? rule.paymentMethods.map((method) => METHOD_NAMES[method]).join(', ') : 'All ways of paying',
  ].filter(Boolean).join(' · ');

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle>Shipping rules</CardTitle>
        <CardDescription>
          Charge by cart value, state, pincode or way of paying, in the popup checkout. The most specific rule wins (pincode, then state, then cart value), and the lowest fee wins a tie. If no rule matches, the flat fee above applies. Shopify checkout keeps your Shopify rates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.length > 0 && (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{rule.name} · {rule.fee === 0 ? 'Free' : `₹${rule.fee}`}{rule.isActive ? '' : ' (off)'}</p>
                  <p className="text-slate-500 break-words">{summary(rule)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => edit(rule)}>Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => remove(rule)}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!editing && <Button variant="outline" onClick={() => { setForm(EMPTY); setEditing(true); }}>Add shipping rule</Button>}

        {editing && (
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="rule-name" className="text-sm font-medium">Rule name</label>
                <Input id="rule-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Metro cities" />
              </div>
              <div className="space-y-2">
                <label htmlFor="rule-fee" className="text-sm font-medium">Shipping fee (₹), 0 for free</label>
                <Input id="rule-fee" type="number" min="0" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label htmlFor="rule-min" className="text-sm font-medium">Cart value from (₹)</label>
                <Input id="rule-min" type="number" min="0" value={form.minCart} onChange={(e) => setForm({ ...form, minCart: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label htmlFor="rule-max" className="text-sm font-medium">Cart value below (₹), optional</label>
                <Input id="rule-max" type="number" min="0" value={form.maxCart} onChange={(e) => setForm({ ...form, maxCart: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label htmlFor="rule-states" className="text-sm font-medium">States, optional</label>
                <Input id="rule-states" value={form.states} onChange={(e) => setForm({ ...form, states: e.target.value })} placeholder="Delhi, Haryana" />
              </div>
              <div className="space-y-2">
                <label htmlFor="rule-pins" className="text-sm font-medium">Pincodes, optional</label>
                <Input id="rule-pins" value={form.pincodes} onChange={(e) => setForm({ ...form, pincodes: e.target.value })} placeholder="110001, 122*" />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Applies to (none ticked means all)</legend>
              <div className="flex flex-wrap gap-4">
                {METHODS.map((method) => (
                  <label key={method} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-slate-900"
                      checked={form.paymentMethods.includes(method)}
                      onChange={(e) => setForm({ ...form, paymentMethods: e.target.checked ? [...form.paymentMethods, method] : form.paymentMethods.filter((item) => item !== method) })}
                    />
                    {METHOD_NAMES[method]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-slate-900" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Rule is on
            </label>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save rule'}</Button>
              <Button variant="outline" onClick={() => { setForm(EMPTY); setEditing(false); }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
