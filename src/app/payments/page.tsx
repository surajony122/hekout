"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { CreditCard, DollarSign, Wallet, ShieldCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function PaymentsPage() {
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

  const paymentSplit = data.paymentSplit || [];
  const COLORS = ['#f59e0b', '#10b981']; // COD = Amber, Prepaid = Emerald

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Monitor payment methods and prepaid conversion.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white">
            Download Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-600">Total Processed</span>
              <DollarSign size={16} className="text-slate-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">₹{(data.totalRevenue || 0).toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-600">Prepaid Share</span>
              <CreditCard size={16} className="text-slate-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">
                {paymentSplit?.[1]?.value ? Math.round((paymentSplit[1].value / data.totalOrders) * 100) : 0}%
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-600">COD Share</span>
              <Wallet size={16} className="text-slate-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">
                {paymentSplit?.[0]?.value ? Math.round((paymentSplit[0].value / data.totalOrders) * 100) : 0}%
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 bg-emerald-50 border-emerald-100">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-emerald-800">Prepaid Incentives Given</span>
              <ShieldCheck size={16} className="text-emerald-500" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-emerald-900">₹{(data.totalPrepaidDiscount || 0).toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Payment Split</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentSplit.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Gateway Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 mt-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold">R</div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Razorpay</h4>
                    <p className="text-xs text-slate-500">Primary Gateway</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">98.2%</div>
                  <div className="text-xs text-emerald-600">Success Rate</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 opacity-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600 font-bold">C</div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Cashfree</h4>
                    <p className="text-xs text-slate-500">Backup Gateway (Inactive)</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">-</div>
                  <div className="text-xs text-slate-500">Success Rate</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
