import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, MoreHorizontal, User } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const cookieStore = await cookies();
  const shop = cookieStore.get('shop_domain')?.value;

  if (!shop) {
    redirect('/');
  }

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain: shop }
  });

  if (!merchant) {
    redirect('/');
  }

  const customers = await prisma.customerProfile.findMany({
    where: { merchantId: merchant.id },
    orderBy: { lastOrderAt: 'desc' }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">{customers.length} total customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white shadow-sm">
            <Download size={14} className="mr-2" /> Export
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-xl">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search customers..." 
              className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 pl-6">Customer</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Contact</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Location</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Status</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3">Last Order</TableHead>
              <TableHead className="font-medium text-slate-500 text-xs uppercase tracking-wider py-3 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <User className="h-8 w-8 text-slate-300 mb-2" />
                    <p>No customers found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                  <TableCell className="py-4 pl-6">
                    <div className="font-medium text-slate-900">{customer.name || 'Guest User'}</div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="text-sm text-slate-700">{customer.phone || '-'}</div>
                    <div className="text-xs text-slate-500">{customer.email || '-'}</div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="text-sm text-slate-700">{customer.city || '-'}, {customer.state || '-'}</div>
                  </TableCell>
                  <TableCell className="py-4">
                    {customer.verificationStatus === 'Verified' ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">OTP Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Unverified</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-sm text-slate-500">
                    {customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                      <MoreHorizontal size={16} />
                    </Button>
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
