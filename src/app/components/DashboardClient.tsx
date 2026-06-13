"use client";

import { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Users, ShoppingCart, ArrowUpRight, Search, ChevronDown, Bell, Download, Eye } from 'lucide-react';

const COLORS = ['#6366f1', '#f59e0b', '#ef4444'];

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
    return <div className="flex h-screen items-center justify-center bg-[#f4f7fe]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div></div>;
  }

  if (!data) return <div>Error loading metrics.</div>;

  const totalSalesGrowth = "+3.1%";
  const totalRevenueGrowth = "+2.4%";
  const activeCustomersGrowth = "+2.4%";
  const refundGrowth = "-0.6%";

  return (
    <div className="bg-[#f4f7fe] min-h-screen p-4 md:p-8 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Welcome, Admin 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage products, orders, customers, and performance in one place.</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <span>12 Sept - 20 Sept</span>
            <ChevronDown size={16} className="text-slate-400" />
          </button>
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={16} className="text-slate-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-1">
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-500">Total Sales</span>
              <div className="p-1.5 bg-slate-50 rounded-full text-slate-400"><TrendingUp size={16} /></div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-slate-900">{data.totalOrders.toLocaleString()}</h3>
              <p className="text-xs font-medium text-emerald-500 mt-1 flex items-center gap-1"><ArrowUpRight size={12}/> {totalSalesGrowth} vs Last Week</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-500">Total Revenue</span>
              <div className="p-1.5 bg-slate-50 rounded-full text-slate-400"><span className="font-bold">₹</span></div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-slate-900">₹{(data.totalRevenue / 1000).toFixed(1)}k</h3>
              <p className="text-xs font-medium text-emerald-500 mt-1 flex items-center gap-1"><ArrowUpRight size={12}/> {totalRevenueGrowth} vs Last Week</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-500">Active Customers</span>
              <div className="p-1.5 bg-slate-50 rounded-full text-slate-400"><Users size={16} /></div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-slate-900">120</h3>
              <p className="text-xs font-medium text-emerald-500 mt-1 flex items-center gap-1"><ArrowUpRight size={12}/> {activeCustomersGrowth} vs Last Week</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-500">Refund Request</span>
              <div className="p-1.5 bg-slate-50 rounded-full text-slate-400"><ShoppingCart size={16} /></div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-slate-900">0</h3>
              <p className="text-xs font-medium text-rose-500 mt-1 flex items-center gap-1"><ArrowUpRight size={12} className="rotate-90"/> {refundGrowth} vs Last Week</p>
            </div>
          </div>
        </div>

        {/* Center Column: Total Profit Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] lg:col-span-2">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Revenue Trend</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-3xl font-bold text-slate-900">₹{data.totalRevenue.toLocaleString()}</span>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"><ArrowUpRight size={12}/> 8.4%</span>
              </div>
            </div>
            <button className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700">
              Last 7 days <ChevronDown size={16} />
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `₹${val/1000}k`} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '12px' }} />
                <Bar dataKey="revenue" fill="#e2e8f0" radius={[4, 4, 0, 0]} activeBar={{ fill: '#6366f1' }} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Success Rate */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] lg:col-span-1 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h2 className="text-lg font-bold text-slate-900">Success Rate</h2>
            <button className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
              Last 7 days <ChevronDown size={14} />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center relative my-4">
            {/* Simple Half Donut using PieChart */}
            <div className="h-40 w-full relative overflow-hidden flex justify-center">
              <ResponsiveContainer width="100%" height="200%">
                <PieChart>
                  <Pie
                    data={[{value: parseFloat(data.conversionRate)}, {value: 100 - parseFloat(data.conversionRate)}]}
                    cx="50%" cy="50%" startAngle={180} endAngle={0} innerRadius={60} outerRadius={80}
                    dataKey="value" stroke="none" cornerRadius={40}
                  >
                    <Cell fill="#6366f1" />
                    <Cell fill="#e0e7ff" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute bottom-4 text-center">
                <span className="text-3xl font-bold text-slate-900">{data.conversionRate}%</span>
                <p className="text-xs text-slate-500 font-medium">Checkout Growth</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1"><TrendingUp size={12}/> Orders</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-slate-900">{data.totalOrders}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1"><span className="font-bold">₹</span> Total Revenue</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-slate-900">₹{(data.totalRevenue / 1000).toFixed(1)}k</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Recent Orders Table */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] lg:col-span-2 overflow-x-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Orders</h2>
              <p className="text-sm text-slate-500">Track the latest customer orders</p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search" className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600">
                Status <ChevronDown size={16} />
              </button>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-sm font-semibold text-slate-500">Order ID</th>
                <th className="pb-3 text-sm font-semibold text-slate-500">Products</th>
                <th className="pb-3 text-sm font-semibold text-slate-500">Customer</th>
                <th className="pb-3 text-sm font-semibold text-slate-500">Date</th>
                <th className="pb-3 text-sm font-semibold text-slate-500">Amount</th>
                <th className="pb-3 text-sm font-semibold text-slate-500">Status</th>
                <th className="pb-3 text-sm font-semibold text-slate-500 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders?.map((order: any, i: number) => (
                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-4 text-sm font-medium text-slate-900">{order.id}</td>
                  <td className="py-4 text-sm text-slate-600 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-lg">🛍️</div>
                    <span className="truncate max-w-[150px]">{order.products}</span>
                  </td>
                  <td className="py-4 text-sm text-slate-600">{order.customer}</td>
                  <td className="py-4 text-sm text-slate-500">{order.date}</td>
                  <td className="py-4 text-sm font-medium text-slate-900">₹{order.amount.toLocaleString()}</td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <button className="text-slate-400 hover:text-indigo-600 transition-colors"><Eye size={18} /></button>
                  </td>
                </tr>
              ))}
              {!data.recentOrders?.length && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">No recent orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sales Overview */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] lg:col-span-1">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-lg font-bold text-slate-900">Sales Overview</h2>
            <button className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
              Last 7 days <ChevronDown size={14} />
            </button>
          </div>

          <div className="flex justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Successful Sales
              </div>
              <div className="text-xl font-bold text-slate-900">47.05%</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div> Pending
              </div>
              <div className="text-xl font-bold text-slate-900">32.48%</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                <div className="w-2 h-2 rounded-full bg-rose-500"></div> Cancelled
              </div>
              <div className="text-xl font-bold text-slate-900">20.47%</div>
            </div>
          </div>

          <div className="flex h-12 w-full gap-1 mb-8">
            <div className="h-full bg-emerald-400 rounded-l-md" style={{width: '47%'}}></div>
            <div className="h-full bg-amber-400" style={{width: '32%'}}></div>
            <div className="h-full bg-rose-400 rounded-r-md" style={{width: '21%'}}></div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
              <span>Product Name</span>
              <div className="flex gap-8">
                <span className="w-12 text-right">Percent</span>
                <span className="w-16 text-right">Earnings</span>
              </div>
            </div>

            <div className="space-y-4">
              {data.topProducts?.map((product: any, i: number) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-sm">📦</div>
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">{product.name}</span>
                  </div>
                  <div className="flex gap-8 text-sm font-medium">
                    <span className="w-12 text-right text-slate-500">{product.percent}%</span>
                    <span className="w-16 text-right text-slate-900">₹{product.earnings.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
