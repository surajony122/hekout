"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { 
  LayoutDashboard, ShoppingCart, Users, Settings, 
  Activity, ArrowDownToLine, RefreshCw, CreditCard,
  PackagePlus, BarChart3, Package
} from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Checkout Funnel', href: '/funnel', icon: Activity },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Recovery', href: '/recovery', icon: RefreshCw },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'COD Intelligence', href: '/cod', icon: ArrowDownToLine },
    { name: 'Upsells', href: '/upsells', icon: PackagePlus },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 -ml-2 mr-2 md:hidden text-slate-600 hover:text-slate-900 transition-colors">
          <Menu size={20} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 flex flex-col h-full bg-white border-r-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div className="p-6 pb-2 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-lg leading-none">C</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">CheckoutFlow</h1>
        </div>
        
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.name}
                href={item.href} 
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-medium transition-colors ${
                  isActive 
                    ? 'bg-slate-100 text-slate-900 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-indigo-600' : ''} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <Link 
            href="/settings" 
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-medium transition-colors ${
              pathname === '/settings'
                ? 'bg-slate-100 text-slate-900 font-semibold' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Settings size={18} className={pathname === '/settings' ? 'text-indigo-600' : ''} />
            Settings
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
