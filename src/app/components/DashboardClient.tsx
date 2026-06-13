"use client";

import { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';
import { ArrowUpRight, TrendingUp, Users, ShoppingCart, Activity } from 'lucide-react';
import TestWidgetButton from './TestWidgetButton';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function DashboardClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json.metrics);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div></div>;
  }

  if (!data) return <div>Error loading metrics.</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Analytics Overview</h1>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
          Last 7 Days
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <TrendingUp size={20} />
            <span className="font-medium">Total Revenue</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">₹{data.totalRevenue.toLocaleString()}</div>
          <div className="text-emerald-500 text-sm mt-2 flex items-center gap-1"><ArrowUpRight size={16} /> +14.5%</div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <ShoppingCart size={20} />
            <span className="font-medium">Total Orders</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{data.totalOrders.toLocaleString()}</div>
          <div className="text-emerald-500 text-sm mt-2 flex items-center gap-1"><ArrowUpRight size={16} /> +8.2%</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Activity size={20} />
            <span className="font-medium">Conversion Rate</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{data.conversionRate}%</div>
          <div className="text-emerald-500 text-sm mt-2 flex items-center gap-1"><ArrowUpRight size={16} /> +2.1%</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Users size={20} />
            <span className="font-medium">Avg Order Value</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">₹{Math.round(data.aov).toLocaleString()}</div>
          <div className="text-slate-400 text-sm mt-2">Stable</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Revenue Trend</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(value) => `₹${value}`} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} formatter={(value: any) => [`₹${value}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Split */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Payment Methods</h2>
          <div className="h-56 w-full flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.paymentSplit} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {data.paymentSplit.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: any) => [value, 'Orders']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {data.paymentSplit.map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                <span className="text-sm font-medium text-slate-700">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Funnel Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Checkout Funnel</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.funnel} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" hide />
              <YAxis dataKey="step" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 13, fontWeight: 500}} />
              <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="users" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32}>
                {data.funnel.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={index === data.funnel.length - 1 ? '#10b981' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Test Widget Section */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-lg p-8 mt-8 text-center max-w-3xl mx-auto text-white">
        <h2 className="text-2xl font-bold mb-3">Test Multi-Step Checkout</h2>
        <p className="text-slate-300 mb-8 max-w-xl mx-auto">Experience the new high-converting GoKwik-style multi-step flow. Enter your phone number to verify, then proceed to the checkout!</p>
        <TestWidgetButton />
      </div>
    </div>
  );
}
