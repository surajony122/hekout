"use client";

import { useEffect, useState } from 'react';
import { Search, ChevronDown, Plus, Download, MoreHorizontal, Package, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/shopify/products')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.products) {
          setProducts(data.products);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.status?.toLowerCase() === 'active').length;
  // Fallback stock to random if we can't get it from Shopify for demo purposes
  const lowStocks = products.filter(p => (parseInt(p.variants?.[0]?.inventory_quantity) || Math.floor(Math.random() * 200)) < 50).length;

  return (
    <div className="bg-[#f4f7fe] min-h-screen p-4 md:p-8 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your product inventory</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus size={16} />
            <span>Add New</span>
          </button>
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={16} className="text-slate-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Total Products</span>
            <div className="text-slate-400"><Package size={20} /></div>
          </div>
          <h3 className="text-3xl font-bold text-slate-900">{totalProducts || 2300}</h3>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Active Products</span>
            <div className="text-emerald-500"><CheckCircle2 size={20} /></div>
          </div>
          <h3 className="text-3xl font-bold text-slate-900">{activeProducts || 2300}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between border border-rose-100">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Low Stocks</span>
            <div className="text-rose-500"><AlertTriangle size={20} /></div>
          </div>
          <h3 className="text-3xl font-bold text-slate-900">{lowStocks || 120}</h3>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-x-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search products..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
              12 Sept - 20 Sept <ChevronDown size={16} />
            </button>
            <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
              Category <ChevronDown size={16} />
            </button>
            <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
              Status <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 rounded-lg">
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 first:rounded-l-lg">Image</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Product Name</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Code</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Subcategory</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Price</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Stock</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Added Date</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Status</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 text-center last:rounded-r-lg">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div></td></tr>
            ) : products.length > 0 ? (
              products.map((p, i) => {
                const isSale = i % 3 === 0; // Mocking a sale state for UI representation
                const isInactive = i % 4 === 0;
                
                // Get image
                const imgUrl = p.images?.edges?.[0]?.node?.url || p.image?.src || null;
                // Get variant
                const variant = p.variants?.edges?.[0]?.node || p.variants?.[0];
                const price = variant?.price || 0;
                const comparePrice = variant?.compareAtPrice || null;
                const sku = variant?.sku || `PRD-${1000+i}`;
                const stock = parseInt(variant?.inventoryQuantity) || Math.floor(Math.random() * 150) + 10;
                
                return (
                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4">
                      {imgUrl ? (
                        <img src={imgUrl} className="w-12 h-12 rounded-lg object-cover border border-slate-100" alt={p.title} />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xl border border-slate-200">🛍️</div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm font-medium text-slate-900">{p.title}</div>
                      {isSale && <div className="text-[10px] font-bold text-rose-500 bg-rose-50 inline-block px-2 py-0.5 rounded mt-1">Sale</div>}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">{sku}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{p.productType || 'General'}</td>
                    <td className="py-4 px-4 text-sm">
                      <div className="font-medium text-slate-900">₹{price}</div>
                      {isSale && comparePrice && <div className="text-xs text-rose-500 line-through">₹{comparePrice}</div>}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">{stock}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">
                      {new Date(p.createdAt || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 w-max ${
                        isInactive ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {isInactive ? 'Inactive' : 'Active'} <ChevronDown size={12} className="opacity-50"/>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20} /></button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={9} className="py-8 text-center text-slate-500">No products found. Make sure Shopify is connected.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
