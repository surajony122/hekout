"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MessageCircle, Clock, TrendingDown } from 'lucide-react';

export default function RecoveryClient({ abandonedOrders }: { abandonedOrders: any[] }) {
  
  const totalAbandonedValue = abandonedOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const getWhatsAppLink = (order: any) => {
    let phone = order.customerPhone || "";
    if (phone && !phone.startsWith('91') && phone.length === 10) phone = '91' + phone;
    const name = order.customerName ? order.customerName.split(' ')[0] : 'there';
    const msg = `Hi ${name}! We noticed you left ${order.productTitle || 'some items'} in your cart. Complete your purchase now to get an extra 10% off!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const getTimeAgo = (dateString: string) => {
    const minutes = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-medium text-slate-900">Abandoned Cart Recovery</h1>
          <p className="text-slate-500 text-sm mt-1">Recover lost sales by reaching out directly to customers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Abandoned Carts</p>
                <h3 className="text-2xl font-semibold text-slate-900">{abandonedOrders.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <TrendingDown size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Lost Revenue Potential</p>
                <h3 className="text-2xl font-semibold text-slate-900">₹{totalAbandonedValue.toLocaleString('en-IN')}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 px-4">Customer</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Product</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Value</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Time</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right px-4">Recover</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {abandonedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                  No abandoned carts found.
                </TableCell>
              </TableRow>
            ) : (
              abandonedOrders.map(order => (
                <TableRow key={order.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <TableCell className="px-4 py-3">
                    <div className="font-medium text-slate-900 text-sm">{order.customerName || 'Anonymous'}</div>
                    <div className="text-xs text-slate-500">{order.customerPhone}</div>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600 max-w-[200px] truncate">
                    {order.productTitle || 'Unknown Product'}
                  </TableCell>
                  <TableCell className="py-3 text-sm font-medium text-slate-900">
                    ₹{order.total?.toLocaleString('en-IN') || 0}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-500">
                    {getTimeAgo(order.createdAt)}
                  </TableCell>
                  <TableCell className="py-3 text-right px-4">
                    {order.customerPhone ? (
                      <a href={getWhatsAppLink(order)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="bg-[#25D366] hover:bg-[#1ebd5a] text-white gap-2">
                          <MessageCircle size={14} />
                          Send WhatsApp
                        </Button>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">No Phone</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

    </div>
  );
}
