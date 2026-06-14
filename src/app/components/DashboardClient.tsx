"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, ArrowDownRight, MoreHorizontal, Download, ArrowUp, Users, RefreshCw, Activity, CreditCard } from 'lucide-react';


export default function DashboardClient() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(res => res.json())
      .then(data => setData(data));
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
    </div>
  );

  const metrics = data.metrics || {};

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Overview</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select defaultValue="this-month">
            <SelectTrigger className="w-[140px] bg-white h-9 shadow-sm">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all-channels">
            <SelectTrigger className="w-[140px] bg-white h-9 shadow-sm">
              <SelectValue placeholder="Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-channels">All Channels</SelectItem>
              <SelectItem value="online">Online Store</SelectItem>
              <SelectItem value="pos">Point of Sale</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9 bg-white shadow-sm">
            <Download size={16} className="text-slate-500" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Metric Cards */}
        <div className="lg:col-span-1 grid grid-cols-2 gap-4">
          
          <Card className="shadow-sm border-slate-200 col-span-2 sm:col-span-1">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-slate-600">Total Sales</span>
                <span className="text-slate-400 font-serif">$</span>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-bold text-slate-900">₹{(metrics.totalRevenue || 0).toLocaleString()}</h3>
                <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center">
                  +15.8% vs last week
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 col-span-2 sm:col-span-1">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-slate-600">Total Orders</span>
                <span className="text-slate-400 font-serif">#</span>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-bold text-slate-900">{metrics.totalOrders || 0}</h3>
                <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center">
                  +8.3% vs last week
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 col-span-2 sm:col-span-1">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-slate-600">Conversion</span>
                <Activity size={14} className="text-slate-400" />
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-bold text-slate-900">{metrics.conversionRate || '0'}%</h3>
                <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center">
                  +12.5% vs last month
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 col-span-2 sm:col-span-1">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-slate-600">Average Order</span>
                <span className="text-slate-400 font-serif">$</span>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-bold text-slate-900">₹{Math.round(metrics.aov || 0).toLocaleString()}</h3>
                <p className="text-xs font-medium text-rose-500 mt-2 flex items-center">
                  -1.2% vs last week
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 col-span-2 sm:col-span-1">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-slate-600">Recovered Rev.</span>
                <RefreshCw size={14} className="text-slate-400" />
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-bold text-slate-900">₹0</h3>
                <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center">
                  +0.6% vs last month
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 col-span-2 sm:col-span-1">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-slate-600">Prepaid Split</span>
                <CreditCard size={14} className="text-slate-400" />
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-bold text-slate-900">
                  {metrics.paymentSplit?.[1]?.value ? Math.round((metrics.paymentSplit[1].value / metrics.totalOrders) * 100) : 0}%
                </h3>
                <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center">
                  +2.4 pts vs last month
                </p>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Main Chart */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="p-5 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">Sales Overview</CardTitle>
            <ArrowUpRight size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" />
          </CardHeader>
          <CardContent className="p-5 pt-4">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.revenueTrend || []} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e293b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#1e293b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} minTickGap={30} />
                  <Area type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
