"use client";

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, MoreHorizontal, ArrowUpRight, Search, Eye } from 'lucide-react';

export default function OrdersClient({ orders, shopDomain }: { orders: any[], shopDomain: string }) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-medium text-slate-900">Recent Orders</h1>
          <p className="text-slate-500 text-sm mt-1">{orders.length} orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-sm">
            <ArrowUpRight size={14} className="text-slate-500" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-sm">
            <Download size={14} className="text-slate-500" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-sm">
            <MoreHorizontal size={14} className="text-slate-500" />
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <Tabs defaultValue="all" className="w-[400px]">
            <TabsList className="bg-slate-100/50 p-1">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">All</TabsTrigger>
              <TabsTrigger value="needs-action" className="text-xs">Needs action</TabsTrigger>
              <TabsTrigger value="unfulfilled" className="text-xs">Unfulfilled</TabsTrigger>
              <TabsTrigger value="unpaid" className="text-xs">Unpaid</TabsTrigger>
              <TabsTrigger value="returns" className="text-xs">Returns</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
              <TableHead className="w-[50px] px-4"><input type="checkbox" className="rounded border-slate-300" /></TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Order</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Customer</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Status</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Total</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Date</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const isCompleted = order.orderStatus === 'Synced';
                
                return (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100" onClick={() => setSelectedOrder(order)}>
                    <TableCell className="px-4"><input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} /></TableCell>
                    <TableCell className="py-4">
                      <div className="font-medium text-slate-900">{order.shopifyOrderId ? `#${order.shopifyOrderId}` : 'Pending'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{order.quantity} items</div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm text-slate-700 font-medium">{order.customerName || 'Guest'}</div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${order.paymentMethod === 'COD' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${order.paymentMethod === 'COD' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                          {order.paymentMethod === 'COD' ? 'Unpaid' : 'Paid'}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {isCompleted ? 'Fulfilled' : 'Unfulfilled'}
                        </span>
                        {order.utmSource && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {order.utmSource}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm font-medium text-slate-900">
                      ₹{order.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="py-4 text-right px-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}>
                        <MoreHorizontal size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
          <div>Viewing {Math.min(10, orders.length)} out of {orders.length} orders</div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500" disabled>Previous</Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs bg-slate-900 text-white border-transparent">1</Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs text-slate-600">2</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-900 font-medium">Next</Button>
          </div>
        </div>
      </Card>

      <Sheet open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Order Details</SheetTitle>
          </SheetHeader>
          
          {selectedOrder && (
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Customer Info</h3>
                <div className="bg-slate-50 rounded-lg p-4 text-sm">
                  <p className="font-medium text-slate-900">{selectedOrder.customerName}</p>
                  <p className="text-slate-600 mt-1">{selectedOrder.customerEmail}</p>
                  <p className="text-slate-600">{selectedOrder.customerPhone}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Shipping Address</h3>
                <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
                  <p>{selectedOrder.address}</p>
                  <p>{selectedOrder.city}, {selectedOrder.state}</p>
                  <p>{selectedOrder.pincode}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Payment Breakdown</h3>
                <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-medium">₹{((selectedOrder.price || 0) * (selectedOrder.quantity || 1)).toLocaleString()}</span>
                  </div>
                  {(selectedOrder.prepaidDiscount > 0) && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Prepaid Savings</span>
                      <span className="font-medium">-₹{selectedOrder.prepaidDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Total Paid</span>
                    <span>₹{selectedOrder.total.toLocaleString()}</span>
                  </div>
                  
                  <div className="pt-4 flex flex-col gap-1 text-xs text-slate-500">
                    <span>Method: <strong className="text-slate-700">{selectedOrder.paymentMethod}</strong></span>
                    {selectedOrder.paymentId && <span>Txn ID: <strong className="text-slate-700">{selectedOrder.paymentId}</strong></span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
