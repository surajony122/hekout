import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, PlusCircle, Activity } from 'lucide-react';
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default function UpsellsPage() {
  
  // Mock data for Upsells
  const upsellFunnels = [
    { name: 'VIP Customer Offer', trigger: 'Spend > ₹5000', impressions: 1250, conversions: 85, revenue: 42500, status: 'Active' },
    { name: 'Standard Cross-sell', trigger: 'All Orders', impressions: 5400, conversions: 210, revenue: 31500, status: 'Active' },
    { name: 'Winter Sale Add-on', trigger: 'Cart contains Winter Item', impressions: 850, conversions: 120, revenue: 18000, status: 'Paused' },
  ];

  const totalRevenue = upsellFunnels.reduce((acc, f) => acc + f.revenue, 0);
  const totalImpressions = upsellFunnels.reduce((acc, f) => acc + f.impressions, 0);
  const totalConversions = upsellFunnels.reduce((acc, f) => acc + f.conversions, 0);
  const avgConversion = ((totalConversions / totalImpressions) * 100).toFixed(1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Post-Purchase Upsells</h1>
          <p className="text-slate-500 text-sm mt-1">Increase AOV by offering one-click upsells after checkout.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
            <PlusCircle size={14} className="mr-2" /> Create Funnel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-600">Extra Revenue Generated</span>
              <ArrowUpRight size={16} className="text-emerald-500" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">₹{totalRevenue.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-600">Average Conversion Rate</span>
              <Activity size={16} className="text-slate-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-slate-900">{avgConversion}%</h3>
              <p className="text-xs text-slate-500 mt-1">From {totalImpressions} impressions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 bg-slate-50">
          <CardContent className="p-5 flex flex-col justify-center items-center text-center h-full">
            <p className="text-sm font-medium text-slate-600">A/B Testing Coming Soon</p>
            <p className="text-xs text-slate-400 mt-1">Split test your offers</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-600">Active Funnels</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Funnel Name</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Trigger Condition</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Views</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Conv. %</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Revenue</TableHead>
                <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upsellFunnels.map((funnel, idx) => (
                <TableRow key={idx}>
                  <TableCell className="py-4 font-medium text-slate-900">{funnel.name}</TableCell>
                  <TableCell className="py-4 text-slate-600 text-sm">{funnel.trigger}</TableCell>
                  <TableCell className="py-4 text-right text-slate-700">{funnel.impressions.toLocaleString()}</TableCell>
                  <TableCell className="py-4 text-right font-medium text-emerald-600">
                    {((funnel.conversions / funnel.impressions) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="py-4 text-right font-bold text-slate-900">
                    ₹{funnel.revenue.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    {funnel.status === 'Active' ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">Paused</Badge>
                    )}
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
