"use client";

import { useState } from 'react';
import { Search, ChevronDown, Download, Eye, ExternalLink, X, MapPin, Package, CreditCard, Tag } from 'lucide-react';

export default function OrdersClient({ orders, shopDomain }: { orders: any[], shopDomain: string }) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  return (
    <div className="bg-[#f4f7fe] min-h-screen p-4 md:p-8 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 text-sm mt-1">Track and manage all customer orders</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <span>Sync Orders</span>
          </button>
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={16} className="text-slate-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-x-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search orders..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:border-indigo-500 transition-all hover:border-indigo-300" />
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Date <ChevronDown size={16} />
            </button>
            <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Status <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 rounded-lg">
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 first:rounded-l-lg">Order ID</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Products</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Customer</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Date</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Amount</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Payment</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Status</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 text-center last:rounded-r-lg">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-500">No orders found. Use the test widget on the overview page to create one.</td></tr>
            ) : (
              orders.map((order) => {
                let productNames = order.productTitle || 'Unknown';
                const isCompleted = order.orderStatus === 'Synced';
                const shopifyUrl = order.shopifyOrderId ? `https://${shopDomain}/admin/orders/${order.shopifyOrderId}` : '#';

                return (
                  <tr key={order.id} onClick={() => setSelectedOrder(order)} className="border-b border-slate-50 last:border-0 hover:bg-indigo-50/40 cursor-pointer transition-colors group">
                    <td className="py-4 px-4 font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {order.shopifyOrderId ? `#${order.shopifyOrderId}` : 'Pending Sync'}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600 flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-lg group-hover:bg-white transition-colors">🛍️</div>
                      <span className="truncate max-w-[150px]">{productNames}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm font-medium text-slate-900">{order.customerName || 'Guest'}</div>
                      <div className="text-xs text-slate-500">{order.customerPhone}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-900">₹{order.total.toLocaleString()}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${order.paymentMethod === 'COD' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {isCompleted ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }} className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors p-1.5 hover:bg-indigo-50 rounded-md" title="View Details">
                          <Eye size={18} />
                        </button>
                        <a href={shopifyUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors p-1.5 hover:bg-indigo-50 rounded-md" title="View in Shopify">
                          <ExternalLink size={18} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Order Details Slide-over Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedOrder(null)}></div>

          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md transform transition ease-in-out duration-300">
              <div className="h-full flex flex-col bg-white shadow-xl overflow-y-scroll">
                <div className="px-6 py-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900" id="slide-over-title">
                      Order Details
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedOrder.shopifyOrderId ? `#${selectedOrder.shopifyOrderId}` : 'Pending Sync'} • {new Date(selectedOrder.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 flex-1">
                  {/* Customer Info */}
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4 uppercase tracking-wider">
                      <Search size={16} className="text-indigo-500" /> Customer
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="font-medium text-slate-900">{selectedOrder.customerName || 'Guest'}</p>
                      <p className="text-sm text-slate-600 mt-1">{selectedOrder.customerEmail}</p>
                      <p className="text-sm text-slate-600">{selectedOrder.customerPhone}</p>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4 uppercase tracking-wider">
                      <MapPin size={16} className="text-indigo-500" /> Shipping Address
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-sm text-slate-700">{selectedOrder.address}</p>
                      <p className="text-sm text-slate-700">{selectedOrder.city}, {selectedOrder.state}</p>
                      <p className="text-sm text-slate-700">{selectedOrder.pincode}</p>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4 uppercase tracking-wider">
                      <Package size={16} className="text-indigo-500" /> Items
                    </h3>
                    <div className="border border-slate-100 rounded-xl divide-y divide-slate-100">
                      <div className="p-4 flex items-center justify-between bg-white rounded-t-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl">🛍️</div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 truncate max-w-[180px]">{selectedOrder.productTitle || 'Product'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Qty: {selectedOrder.quantity}</p>
                          </div>
                        </div>
                        <p className="font-medium text-slate-900">₹{(selectedOrder.price || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4 uppercase tracking-wider">
                      <CreditCard size={16} className="text-indigo-500" /> Payment Breakdown
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-medium text-slate-900">₹{((selectedOrder.price || 0) * (selectedOrder.quantity || 1)).toLocaleString()}</span>
                      </div>
                      
                      {(selectedOrder.prepaidDiscount > 0) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-600 flex items-center gap-1"><Tag size={14} /> Prepaid Savings</span>
                          <span className="font-medium text-emerald-600">-₹{selectedOrder.prepaidDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      
                      {(selectedOrder.couponDiscount > 0) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-600 flex items-center gap-1"><Tag size={14} /> Coupon {selectedOrder.couponCode ? `(${selectedOrder.couponCode})` : ''}</span>
                          <span className="font-medium text-emerald-600">-₹{selectedOrder.couponDiscount.toLocaleString()}</span>
                        </div>
                      )}

                      <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-slate-900">Total Paid</span>
                        <span className="font-bold text-lg text-indigo-600">₹{(selectedOrder.total || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Method Info */}
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-2">
                      <div className="flex flex-col gap-1">
                        <span>Method: <strong className="text-slate-700">{selectedOrder.paymentMethod}</strong></span>
                        {selectedOrder.paymentId && <span>Txn ID: <strong className="text-slate-700">{selectedOrder.paymentId}</strong></span>}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 border-t border-slate-200 bg-slate-50">
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
