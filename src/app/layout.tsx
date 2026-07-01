import type { Metadata } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { 
  Search, Bell, ChevronDown 
} from 'lucide-react';
import { Toaster } from 'sonner';

import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';

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
        
        {/* Sidebar (Hidden on mobile) */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
          
          {/* Top Navbar */}
          <header className="h-16 flex items-center px-4 md:px-8 justify-between border-b border-slate-200 bg-white z-10">
            <div className="flex items-center gap-2 md:gap-4">
              <MobileNav />
              <div className="flex items-center gap-2 px-2 py-1.5 md:px-3 md:py-1.5 border border-slate-200 rounded-md bg-white cursor-pointer hover:bg-slate-50 transition-colors text-xs md:text-sm font-medium">
                <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm bg-slate-100 flex items-center justify-center text-[10px] md:text-xs">🛍️</div>
                <span className="hidden sm:inline">My Shopify Store</span>
                <span className="sm:hidden">Store</span>
                <ChevronDown size={14} className="text-slate-400 ml-1" />
              </div>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="relative hidden sm:block">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search..." className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 w-48 md:w-64 bg-slate-50" />
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
          <div className="flex-1 overflow-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
        
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
