import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, Tag, Users, Settings } from 'lucide-react';

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
      <body className="bg-[#f4f7fe] text-gray-900 font-sans antialiased flex h-screen overflow-hidden">
        
        {/* Bloom Style Sidebar */}
        <aside className="w-64 bg-white flex flex-col h-full border-r border-slate-100 relative z-10">
          <div className="p-6 pb-2 border-b border-slate-50">
            <h1 className="text-2xl font-black text-indigo-600 tracking-tight">BLOOM.</h1>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 text-indigo-600 font-bold transition-colors">
              <LayoutDashboard size={20} />
              Dashboard
            </Link>
            <Link href="/products" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors">
              <Tag size={20} />
              Products
            </Link>
            <Link href="/orders" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors">
              <ShoppingCart size={20} />
              Orders
            </Link>
            <Link href="/discounts" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors">
              <Tag size={20} />
              Discounts
            </Link>
            <Link href="/customers" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors">
              <Users size={20} />
              Customers
            </Link>
          </nav>

          <div className="p-4 border-t border-slate-100">
            <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors">
              <Settings size={20} />
              Settings
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          
          {/* Top Navbar */}
          <header className="h-20 flex items-center px-8 justify-between z-10">
            <div className="flex-1">
              <div className="relative w-64 hidden md:block">
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-sm px-4 py-2 bg-white shadow-sm border border-slate-100 text-indigo-600 rounded-full font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Shopify Connected
              </button>
            </div>
          </header>
          
          {/* Page Content */}
          <div className="flex-1 overflow-auto bg-[#f4f7fe]">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}
