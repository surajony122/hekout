"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Filter, Download, Package } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(res => res.json())
      .then(res => setData(res.metrics || {}));
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
    </div>
  );

  const topProducts = data.topProducts || [];
  const revenueTrend = data.revenueTrend || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Deep dive into store performance and product metrics.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white">
            <Filter size={14} className="mr-2" /> Filter
          </Button>
          <Button variant="outline" size="sm" className="bg-white">
            <Download size={14} className="mr-2" /> Export
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-0 border-b border-slate-100 mb-4">
          <CardTitle className="text-sm font-medium text-slate-600 pb-4">Revenue Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full relative">
            {data.totalRevenue === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                <Package className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">No revenue data yet.</p>
              </div>
            ) : null}
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']}
                />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${val}`} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Top Performing Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Product Name</TableHead>
                  <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="h-32 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="h-8 w-8 text-slate-300 mb-2" />
                        <p>No product data yet.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  topProducts.map((product: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="py-4">
                        <div className="font-medium text-slate-900 line-clamp-1">{product.name}</div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                          <div className="bg-slate-900 h-1.5 rounded-full" style={{ width: `${product.percent}%` }}></div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-right font-medium text-slate-900">
                        ₹{product.earnings.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Checkout Drop-off Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full mt-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.funnel || []} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis dataKey="step" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} width={100} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`${value} Users`, 'Reached']}
                  />
                  <Bar dataKey="users" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 text-center mt-4">Tracks the conversion journey of all visitors.</p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
