"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Filter, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function FunnelPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(res => res.json())
      .then(res => setData(res.metrics));
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
    </div>
  );

  const funnelData = data.funnel || [];
  
  // Calculate drop-offs
  const enrichedFunnel = funnelData.map((step: any, index: number) => {
    const prevUsers = index === 0 ? step.users : funnelData[index - 1].users;
    const dropoff = prevUsers > 0 ? ((prevUsers - step.users) / prevUsers * 100).toFixed(1) : 0;
    return {
      ...step,
      dropoff: index === 0 ? null : dropoff,
      conversionRate: funnelData[0]?.users > 0 ? ((step.users / funnelData[0].users) * 100).toFixed(1) : 0
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Checkout Funnel</h1>
          <p className="text-slate-500 mt-1">Analyze where customers are dropping off.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Funnel Conversion Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrichedFunnel} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="step" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="users" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          {enrichedFunnel.map((step: any, idx: number) => (
            <Card key={idx} className="shadow-sm border-slate-200">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Step {idx + 1}</div>
                <div className="text-sm font-medium text-slate-900">{step.step}</div>
                <div className="mt-3 flex justify-between items-end">
                  <span className="text-2xl font-bold text-slate-900">{step.users}</span>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    {step.conversionRate}% Conv
                  </span>
                </div>
                {step.dropoff && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-rose-500 font-medium flex items-center">
                    ↓ {step.dropoff}% drop-off from previous
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

    </div>
  );
}
