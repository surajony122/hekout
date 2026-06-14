"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, MapPin, AlertTriangle, Filter } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function CodIntelligencePage() {
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

  const codOrders = data.paymentSplit?.find((s: any) => s.name === 'COD')?.value || 0;
  
  // Mock data for COD risk
  const highRiskAreas = [
    { state: 'Uttar Pradesh', city: 'Noida', riskScore: 85, rtoRate: '32%', orders: 145 },
    { state: 'Haryana', city: 'Gurugram', riskScore: 78, rtoRate: '28%', orders: 98 },
    { state: 'Bihar', city: 'Patna', riskScore: 72, rtoRate: '24%', orders: 67 },
    { state: 'West Bengal', city: 'Kolkata', riskScore: 65, rtoRate: '19%', orders: 210 },
    { state: 'Maharashtra', city: 'Pune', riskScore: 45, rtoRate: '12%', orders: 340 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">COD Intelligence</h1>
          <p className="text-slate-500 text-sm mt-1">Identify high-risk RTO locations and protect margins.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white">
            <Filter size={14} className="mr-2" /> Filter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-600">Total COD Orders</span>
              <MapPin size={16} className="text-slate-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">{codOrders}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-rose-600">High Risk Orders Blocked</span>
              <ShieldAlert size={16} className="text-rose-500" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">12</h3>
              <p className="text-xs text-slate-500 mt-1">₹4,500 in potential RTO saved</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-amber-600">Partial COD Collected</span>
              <AlertTriangle size={16} className="text-amber-500" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">₹0</h3>
              <p className="text-xs text-slate-500 mt-1">From 0 orders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-600">High Risk Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Location</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Total Orders</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Historical RTO %</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Risk Level</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {highRiskAreas.map((area, idx) => (
                <TableRow key={idx}>
                  <TableCell className="py-3 font-medium text-slate-900">
                    {area.city}, <span className="text-slate-500 font-normal">{area.state}</span>
                  </TableCell>
                  <TableCell className="py-3 text-slate-700">{area.orders}</TableCell>
                  <TableCell className="py-3 text-slate-700">{area.rtoRate}</TableCell>
                  <TableCell className="py-3">
                    {area.riskScore >= 75 ? (
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">High Risk</Badge>
                    ) : area.riskScore >= 60 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Medium Risk</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Low Risk</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button variant="outline" size="sm" className="h-7 text-xs">Block COD</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
