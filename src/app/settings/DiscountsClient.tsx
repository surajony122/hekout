'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProductSelector, { type SelectedProduct } from '@/components/ProductSelector';

type Slab = { min: string; type: string; value: string };
type Collection = { id: string; title: string };

type Saved = {
  id: string;
  code: string;
  title: string;
  description: string;
  type: string;
  value: number;
  isAuto: boolean;
  canCombine: boolean;
  minItems: number;
  minCartValue: number;
  maxDiscount: number | null;
  isActive: boolean;
  slabs: unknown;
  giftVariantId: string | null;
  giftTitle: string | null;
  giftQuantity: number;
  collections: unknown;
  paymentMethods: string[];
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  startsAt: string;
  endsAt: string;
  showInCheckout: boolean;
};

const TYPE_NAMES: Record<string, string> = {
  percentage: 'Percentage off',
  flat: 'Fixed amount off',
  slab: 'Slabs (spend more, save more)',
  free_gift: 'Free gift',
  free_shipping: 'Free shipping',
};
const METHODS = [['COD', 'COD'], ['PREPAID', 'Prepaid'], ['PARTIAL COD', 'Partial COD']];

const EMPTY = {
  id: '',
  code: '',
  title: '',
  description: '',
  type: 'percentage',
  value: '',
  isAuto: false,
  canCombine: false,
  minItems: '',
  minCartValue: '',
  maxDiscount: '',
  isActive: true,
  slabs: [{ min: '', type: 'percentage', value: '' }] as Slab[],
  gift: null as SelectedProduct | null,
  giftQuantity: '1',
  collections: [] as Collection[],
  paymentMethods: [] as string[],
  usageLimit: '',
  perCustomerLimit: '',
  startsAt: '',
  endsAt: '',
  showInCheckout: true,
};

const blankIfNull = (value: number | null) => (value === null ? '' : String(value));

function describe(discount: Saved) {
  const collections = Array.isArray(discount.collections) ? discount.collections as Collection[] : [];
  const slabs = Array.isArray(discount.slabs) ? discount.slabs as { min: number; type: string; value: number }[] : [];
  const offer =
    discount.type === 'percentage' ? `${discount.value}% off` :
    discount.type === 'flat' ? `₹${discount.value} off` :
    discount.type === 'slab' ? slabs.map((slab) => `₹${slab.min}+: ${slab.type === 'percentage' ? `${slab.value}%` : `₹${slab.value}`}`).join(', ') :
    discount.type === 'free_gift' ? `Free: ${discount.giftTitle ?? 'gift'}` :
    'Free shipping';
  return [
    offer,
    discount.minCartValue > 0 ? `Cart from ₹${discount.minCartValue}` : null,
    collections.length > 0 ? collections.map((collection) => collection.title).join(', ') : null,
    discount.usageLimit !== null ? `Used ${discount.usageCount} of ${discount.usageLimit}` : `Used ${discount.usageCount}`,
  ].filter(Boolean).join(' · ');
}

export default function DiscountsClient({ initialDiscounts: discounts, shopDomain }: { initialDiscounts: Saved[]; shopDomain: string }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);

  useEffect(() => {
    if (!editing || collectionsLoaded) return;
    fetch('/api/shopify/collections')
      .then((res) => res.json())
      .then((data) => { if (data.success) setAllCollections(data.collections); })
      .catch(() => {})
      .finally(() => setCollectionsLoaded(true));
  }, [editing, collectionsLoaded]);

  const update = (changes: Partial<typeof EMPTY>) => setForm((current) => ({ ...current, ...changes }));

  const startEdit = (discount: Saved) => {
    setForm({
      ...EMPTY,
      id: discount.id,
      code: discount.code,
      title: discount.title,
      description: discount.description,
      type: discount.type,
      value: discount.value ? String(discount.value) : '',
      isAuto: discount.isAuto,
      canCombine: discount.canCombine,
      minItems: discount.minItems ? String(discount.minItems) : '',
      minCartValue: discount.minCartValue ? String(discount.minCartValue) : '',
      maxDiscount: blankIfNull(discount.maxDiscount),
      isActive: discount.isActive,
      slabs: Array.isArray(discount.slabs) && discount.slabs.length > 0
        ? (discount.slabs as { min: number; type: string; value: number }[]).map((slab) => ({ min: String(slab.min), type: slab.type, value: String(slab.value) }))
        : EMPTY.slabs,
      gift: discount.giftVariantId ? { title: discount.giftTitle ?? 'Free gift', variantId: discount.giftVariantId, price: '0', imageUrl: null } : null,
      giftQuantity: String(discount.giftQuantity),
      collections: Array.isArray(discount.collections) ? discount.collections as Collection[] : [],
      paymentMethods: discount.paymentMethods,
      usageLimit: blankIfNull(discount.usageLimit),
      perCustomerLimit: blankIfNull(discount.perCustomerLimit),
      startsAt: discount.startsAt,
      endsAt: discount.endsAt,
      showInCheckout: discount.showInCheckout,
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: form.id || undefined,
          giftVariantId: form.gift?.variantId,
          giftTitle: form.gift?.title,
          gift: undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Offer saved.');
      setForm(EMPTY);
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not save this offer.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (discount: Saved) => {
    const res = await fetch('/api/settings/discounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: discount.id }),
    });
    if (!res.ok) {
      toast.error('Could not delete this offer.');
      return;
    }
    toast.success('Offer deleted.');
    router.refresh();
  };

  const canHaveMaximum = form.type === 'percentage' || form.type === 'slab';

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Checkout offers</CardTitle>
          <CardDescription>
            Codes, automatic offers, slabs and free gifts for the popup checkout. They don&apos;t apply on Shopify checkout (OTP Verify and Pay Online), so use Shopify discounts for those.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {discounts.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {discounts.map((discount) => (
                <li key={discount.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {discount.title} · {discount.isAuto ? 'Automatic' : discount.code}{discount.isActive ? '' : ' (off)'}
                    </p>
                    <p className="text-slate-500 break-words">{describe(discount)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => startEdit(discount)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => remove(discount)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!editing && <Button variant="outline" onClick={() => { setForm(EMPTY); setEditing(true); }}>Create offer</Button>}

          {editing && (
            <div className="border border-slate-200 rounded-lg p-4 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="offer-title" className="text-sm font-medium">Offer name</label>
                  <Input id="offer-title" value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. Diwali sale" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="offer-type" className="text-sm font-medium">Offer type</label>
                  <select id="offer-type" className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-sm" value={form.type} onChange={(e) => update({ type: e.target.value })}>
                    {Object.entries(TYPE_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">How customers get it</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" className="accent-slate-900" checked={!form.isAuto} onChange={() => update({ isAuto: false })} />With a code</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" className="accent-slate-900" checked={form.isAuto} onChange={() => update({ isAuto: true })} />Automatically</label>
                </div>
              </fieldset>

              {!form.isAuto && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="offer-code" className="text-sm font-medium">Code</label>
                    <Input id="offer-code" value={form.code} onChange={(e) => update({ code: e.target.value.toUpperCase() })} placeholder="SAVE10" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="offer-desc" className="text-sm font-medium">Line shown to customers, optional</label>
                    <Input id="offer-desc" value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="10% off above ₹999" />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer md:col-span-2">
                    <input type="checkbox" className="w-4 h-4 accent-slate-900" checked={form.showInCheckout} onChange={(e) => update({ showInCheckout: e.target.checked })} />
                    List this code in the checkout&apos;s coupon screen
                  </label>
                </div>
              )}

              {(form.type === 'percentage' || form.type === 'flat') && (
                <div className="space-y-2 md:w-1/2">
                  <label htmlFor="offer-value" className="text-sm font-medium">{form.type === 'percentage' ? 'Percentage off (%)' : 'Amount off (₹)'}</label>
                  <Input id="offer-value" type="number" min="0" value={form.value} onChange={(e) => update({ value: e.target.value })} />
                </div>
              )}

              {form.type === 'slab' && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Slabs. The highest slab the cart reaches applies.</legend>
                  {form.slabs.map((slab, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <Input aria-label="Cart value from" type="number" min="0" className="w-32" placeholder="Cart from ₹" value={slab.min} onChange={(e) => update({ slabs: form.slabs.map((item, i) => (i === index ? { ...item, min: e.target.value } : item)) })} />
                      <select aria-label="Slab discount type" className="h-9 px-2 border border-slate-200 rounded-md bg-white text-sm" value={slab.type} onChange={(e) => update({ slabs: form.slabs.map((item, i) => (i === index ? { ...item, type: e.target.value } : item)) })}>
                        <option value="percentage">% off</option>
                        <option value="flat">₹ off</option>
                      </select>
                      <Input aria-label="Slab discount" type="number" min="0" className="w-24" placeholder="Value" value={slab.value} onChange={(e) => update({ slabs: form.slabs.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)) })} />
                      {form.slabs.length > 1 && <Button variant="outline" size="sm" onClick={() => update({ slabs: form.slabs.filter((_, i) => i !== index) })}>Remove</Button>}
                    </div>
                  ))}
                  {form.slabs.length < 10 && <Button variant="outline" size="sm" onClick={() => update({ slabs: [...form.slabs, { min: '', type: 'percentage', value: '' }] })}>Add slab</Button>}
                </fieldset>
              )}

              {form.type === 'free_gift' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Gift product</p>
                    <ProductSelector value={form.gift} onChange={(product) => update({ gift: product })} label="Choose the gift" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="offer-gift-qty" className="text-sm font-medium">Quantity</label>
                    <Input id="offer-gift-qty" type="number" min="1" max="10" value={form.giftQuantity} onChange={(e) => update({ giftQuantity: e.target.value })} />
                  </div>
                </div>
              )}

              <details className="border border-slate-100 rounded-lg p-3" open>
                <summary className="text-sm font-medium cursor-pointer">Conditions and limits</summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <label htmlFor="offer-min" className="text-sm font-medium">Minimum cart value (₹)</label>
                    <Input id="offer-min" type="number" min="0" value={form.minCartValue} onChange={(e) => update({ minCartValue: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="offer-items" className="text-sm font-medium">Minimum items</label>
                    <Input id="offer-items" type="number" min="0" value={form.minItems} onChange={(e) => update({ minItems: e.target.value })} />
                  </div>
                  {canHaveMaximum && (
                    <div className="space-y-2">
                      <label htmlFor="offer-max" className="text-sm font-medium">Maximum discount (₹)</label>
                      <Input id="offer-max" type="number" min="0" value={form.maxDiscount} onChange={(e) => update({ maxDiscount: e.target.value })} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="offer-limit" className="text-sm font-medium">Total uses allowed</label>
                    <Input id="offer-limit" type="number" min="1" value={form.usageLimit} onChange={(e) => update({ usageLimit: e.target.value })} placeholder="No limit" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="offer-per" className="text-sm font-medium">Uses per customer</label>
                    <Input id="offer-per" type="number" min="1" value={form.perCustomerLimit} onChange={(e) => update({ perCustomerLimit: e.target.value })} placeholder="No limit" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="offer-start" className="text-sm font-medium">Starts</label>
                    <Input id="offer-start" type="date" value={form.startsAt} onChange={(e) => update({ startsAt: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="offer-end" className="text-sm font-medium">Ends</label>
                    <Input id="offer-end" type="date" value={form.endsAt} onChange={(e) => update({ endsAt: e.target.value })} />
                  </div>
                </div>

                <fieldset className="space-y-2 mt-4">
                  <legend className="text-sm font-medium">Ways of paying (none ticked means all)</legend>
                  <div className="flex flex-wrap gap-4">
                    {METHODS.map(([id, name]) => (
                      <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-slate-900"
                          checked={form.paymentMethods.includes(id)}
                          onChange={(e) => update({ paymentMethods: e.target.checked ? [...form.paymentMethods, id] : form.paymentMethods.filter((item) => item !== id) })}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-2 mt-4">
                  <legend className="text-sm font-medium">Collections (none ticked means the whole cart)</legend>
                  {!collectionsLoaded && <p className="text-sm text-slate-500">Loading your collections...</p>}
                  {collectionsLoaded && allCollections.length === 0 && <p className="text-sm text-slate-500">No collections found in your store.</p>}
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {allCollections.map((collection) => (
                      <label key={collection.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-slate-900"
                          checked={form.collections.some((item) => item.id === collection.id)}
                          onChange={(e) => update({ collections: e.target.checked ? [...form.collections, collection] : form.collections.filter((item) => item.id !== collection.id) })}
                        />
                        {collection.title}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-2 mt-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-slate-900" checked={form.canCombine} onChange={(e) => update({ canCombine: e.target.checked })} />
                    Can combine with other offers and Shopify discounts
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-slate-900" checked={form.isActive} onChange={(e) => update({ isActive: e.target.checked })} />
                    Offer is on
                  </label>
                </div>
              </details>

              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save offer'}</Button>
                <Button variant="outline" onClick={() => { setForm(EMPTY); setEditing(false); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Shopify discounts</CardTitle>
          <CardDescription>Codes and automatic discounts you create in Shopify also work in the popup, and they&apos;re the ones that apply on Shopify checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={`https://${shopDomain}/admin/discounts`} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-900 underline">
            Manage discounts in Shopify
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
