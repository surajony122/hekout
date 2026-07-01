import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { GeistSans } from 'geist/font/sans';
import { 
  LayoutDashboard, ShoppingCart, Users, Settings, 
  Activity, ArrowDownToLine, RefreshCw, CreditCard,
  PackagePlus, BarChart3, Search, Bell, ChevronDown, Tag 
} from 'lucide-react';

import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'CheckoutFlow Dashboard',
  description: 'Shopify Checkout Optimization Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${GeistSans.className} bg-slate-50 text-slate-900 antialiased flex h-screen overflow-hidden`}>
        
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
          
          {/* Top Navbar */}
          <header className="h-16 flex items-center px-8 justify-between border-b border-slate-200 bg-white z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-md bg-white cursor-pointer hover:bg-slate-50 transition-colors text-sm font-medium">
                <div className="w-5 h-5 rounded-sm bg-slate-100 flex items-center justify-center text-xs">🛍️</div>
                <span>My Shopify Store</span>
                <ChevronDown size={14} className="text-slate-400 ml-1" />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search..." className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 w-64 bg-slate-50" />
              </div>
              <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
              </button>
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-medium cursor-pointer">
                JS
              </div>
            </div>
          </header>
          
          {/* Page Content */}
          <div className="flex-1 overflow-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}
