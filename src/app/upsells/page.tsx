"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, PlusCircle, Activity, Trash2, Power } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import ProductSelector, { SelectedProduct } from "@/components/ProductSelector";

export default function UpsellsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [funnels, setFunnels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    offerTitle: '',
    offerVariantId: '',
    offerPrice: '',
    discountType: 'percentage',
    discountValue: '',
    triggerVariantId: ''
  });

  const [triggerType, setTriggerType] = useState('all'); // all, product, collection
  const [selectedTriggerProduct, setSelectedTriggerProduct] = useState<SelectedProduct | null>(null);
  const [selectedOfferProduct, setSelectedOfferProduct] = useState<SelectedProduct | null>(null);
  const [selectedCollection, setSelectedCollection] = useState('summer-collection');

  const fetchFunnels = async () => {
    try {
      const res = await fetch('/api/dashboard/upsells');
      const data = await res.json();
      setFunnels(data.funnels || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    fetchFunnels();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferProduct) {
      alert("Please select an offer product.");
      return;
    }

    const payload = {
      ...formData,
      offerVariantId: selectedOfferProduct.variantId,
      offerPrice: selectedOfferProduct.price,
      triggerVariantId: triggerType === 'product' && selectedTriggerProduct ? selectedTriggerProduct.variantId : '',
      // Add logic for collection if supported in backend later
    };

    try {
      await fetch('/api/dashboard/upsells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setIsModalOpen(false);
      setFormData({ name: '', offerTitle: '', offerVariantId: '', offerPrice: '', discountType: 'percentage', discountValue: '', triggerVariantId: '' });
      setSelectedOfferProduct(null);
      setSelectedTriggerProduct(null);
      setTriggerType('all');
      fetchFunnels();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await fetch('/api/dashboard/upsells', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !currentStatus })
    });
    fetchFunnels();
  };

  const deleteFunnel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this upsell?')) return;
    await fetch('/api/dashboard/upsells', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    fetchFunnels();
  };

  const totalRevenue = funnels.reduce((acc, f) => acc + (f.revenue || 0), 0);
  const totalImpressions = funnels.reduce((acc, f) => acc + (f.impressions || 0), 0);
  const totalConversions = funnels.reduce((acc, f) => acc + (f.conversions || 0), 0);
  const avgConversion = totalImpressions > 0 ? ((totalConversions / totalImpressions) * 100).toFixed(1) : '0.0';

  if (loading) return <div className="p-8 text-center text-slate-500">Loading upsells...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Post-Purchase Upsells</h1>
          <p className="text-slate-500 text-sm mt-1">Increase AOV by offering one-click upsells inside the checkout flow.</p>
        </div>
        
        <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 shadow-md">
              <PlusCircle size={14} className="mr-2" /> Create Funnel
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[540px] overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-xl">Create Upsell Funnel</SheetTitle>
              <SheetDescription>Design a post-purchase offer that converts.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleCreate} className="space-y-8">
              
              {/* Funnel Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">1. Funnel Details</h3>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">Internal Name</label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Summer Sale AirPods" className="mt-1.5 focus-visible:ring-indigo-500" />
                </div>
              </div>

              {/* Trigger */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">2. Trigger Rules</h3>
                <p className="text-xs text-slate-500">When should this offer be shown?</p>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase mb-1.5 block">Trigger Type</label>
                  <select className="w-full border border-slate-200 rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={triggerType} onChange={e => setTriggerType(e.target.value)}>
                    <option value="all">All Orders (Show every time)</option>
                    <option value="product">Specific Product in Cart</option>
                    <option value="collection">Specific Collection in Cart</option>
                  </select>
                </div>
                
                {triggerType === 'product' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase mb-1.5 block">Select Trigger Product</label>
                    <ProductSelector value={selectedTriggerProduct} onChange={setSelectedTriggerProduct} label="Choose product..." />
                  </div>
                )}

                {triggerType === 'collection' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase mb-1.5 block">Select Trigger Collection</label>
                    <select className="w-full border border-slate-200 rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={selectedCollection} onChange={e => setSelectedCollection(e.target.value)}>
                      <option value="summer-collection">Summer Collection 2024</option>
                      <option value="bestsellers">Bestsellers</option>
                      <option value="accessories">Accessories</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1.5">Note: Real collection fetching is mocked for this phase.</p>
                  </div>
                )}
              </div>

              {/* Offer */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">3. The Offer</h3>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase mb-1.5 block">Select Upsell Product</label>
                  <ProductSelector value={selectedOfferProduct} onChange={setSelectedOfferProduct} label="Choose product to upsell..." />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase mb-1.5 block">Offer Display Title</label>
                  <Input required value={formData.offerTitle} onChange={e => setFormData({...formData, offerTitle: e.target.value})} placeholder="e.g. Add the matching case!" className="focus-visible:ring-indigo-500" />
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase mb-1.5 block">Discount Type</label>
                    <select className="w-full border border-slate-200 rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.discountType} onChange={e => setFormData({...formData, discountType: e.target.value})}>
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase mb-1.5 block">Discount Value</label>
                    <Input required type="number" value={formData.discountValue} onChange={e => setFormData({...formData, discountValue: e.target.value})} placeholder="e.g. 50" className="bg-white focus-visible:ring-indigo-500" />
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-8 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700">Save & Publish</Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-600">Extra Revenue Generated</span>
              <ArrowUpRight size={16} className="text-emerald-500" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">₹{totalRevenue.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-600">Average Conversion Rate</span>
              <Activity size={16} className="text-slate-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">{avgConversion}%</h3>
              <p className="text-xs text-slate-500 mt-1">From {totalImpressions} impressions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 bg-slate-50">
          <CardContent className="p-5 flex flex-col justify-center items-center text-center h-full">
            <p className="text-sm font-medium text-slate-600">A/B Testing Coming Soon</p>
            <p className="text-xs text-slate-400 mt-1">Split test your offers</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-600">Active Funnels</CardTitle>
        </CardHeader>
        <CardContent>
          {funnels.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">No upsells created yet. Click &quot;Create Funnel&quot; to start.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Funnel Name</TableHead>
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Offer</TableHead>
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Views</TableHead>
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Conv. %</TableHead>
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Revenue</TableHead>
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Status</TableHead>
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnels.map((funnel) => (
                  <TableRow key={funnel.id}>
                    <TableCell className="py-4 font-medium text-slate-900">{funnel.name}</TableCell>
                    <TableCell className="py-4 text-slate-600 text-sm">{funnel.offerTitle} ({funnel.discountValue}{funnel.discountType === 'percentage' ? '%' : '₹'} off)</TableCell>
                    <TableCell className="py-4 text-right text-slate-700">{funnel.impressions.toLocaleString()}</TableCell>
                    <TableCell className="py-4 text-right font-medium text-emerald-600">
                      {funnel.impressions > 0 ? ((funnel.conversions / funnel.impressions) * 100).toFixed(1) : '0.0'}%
                    </TableCell>
                    <TableCell className="py-4 text-right font-bold text-slate-900">
                      ₹{funnel.revenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      {funnel.isActive ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(funnel.id, funnel.isActive)}>
                        <Power size={14} className={funnel.isActive ? "text-emerald-500" : "text-slate-400"} />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteFunnel(funnel.id)}>
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
