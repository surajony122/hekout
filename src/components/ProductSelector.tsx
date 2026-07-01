"use client";

import { useState, useEffect } from 'react';
import { Search, Package, Check, ChevronDown } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface SelectedProduct {
  title: string;
  variantId: string;
  price: string;
  imageUrl: string | null;
}

interface ProductSelectorProps {
  value?: SelectedProduct | null;
  onChange: (product: SelectedProduct) => void;
  label?: string;
}

export default function ProductSelector({ value, onChange, label = "Select a product" }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open && products.length === 0) {
      setLoading(true);
      fetch('/api/shopify/products')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.products) {
            setProducts(data.products);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, products.length]);

  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    (p.variants?.edges?.[0]?.node?.sku || p.variants?.[0]?.sku || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="border border-slate-200 rounded-md p-3 flex justify-between items-center cursor-pointer hover:border-indigo-400 bg-white transition-colors">
          {value ? (
            <div className="flex items-center gap-3">
              {value.imageUrl ? (
                <img src={value.imageUrl} alt={value.title} className="w-8 h-8 rounded object-cover border border-slate-100" />
              ) : (
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400"><Package size={14} /></div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-900 line-clamp-1">{value.title}</p>
                <p className="text-xs text-slate-500">₹{value.price}</p>
              </div>
            </div>
          ) : (
            <span className="text-sm text-slate-500">{label}</span>
          )}
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="px-4 py-4 border-b border-slate-100 bg-slate-50/50">
          <DialogTitle>Select Product</DialogTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search products by name or SKU..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 border-slate-200 focus-visible:ring-indigo-500"
            />
          </div>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {loading ? (
            <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No products found.</div>
          ) : (
            filteredProducts.map((p, idx) => {
              const variant = p.variants?.edges?.[0]?.node || p.variants?.[0];
              const variantId = variant?.id ? variant.id.replace('gid://shopify/ProductVariant/', '') : '';
              const price = variant?.price || '0';
              const imgUrl = p.images?.edges?.[0]?.node?.url || p.image?.src || null;
              
              const isSelected = value?.variantId === variantId;

              return (
                <div 
                  key={idx}
                  onClick={() => {
                    onChange({ title: p.title, variantId, price, imageUrl: imgUrl });
                    setOpen(false);
                  }}
                  className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  {imgUrl ? (
                    <img src={imgUrl} className="w-10 h-10 rounded-md object-cover border border-slate-100" alt={p.title} />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400"><Package size={16} /></div>
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>{p.title}</p>
                    <p className="text-xs text-slate-500">{variant?.sku || 'No SKU'} • ₹{price}</p>
                  </div>
                  {isSelected && <Check size={18} className="text-indigo-600" />}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
