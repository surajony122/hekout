import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

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
      <body className="bg-gray-50 text-gray-900 font-sans antialiased flex h-screen overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shadow-xl">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-emerald-400">CheckoutFlow</h1>
            <p className="text-slate-400 text-xs mt-1">Merchant Dashboard v1.0</p>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <Link href="/" className="block px-4 py-2 rounded-md hover:bg-slate-800 transition">Overview</Link>
            <Link href="/orders" className="block px-4 py-2 rounded-md hover:bg-slate-800 transition">Orders</Link>
            <Link href="/customers" className="block px-4 py-2 rounded-md hover:bg-slate-800 transition">Customers</Link>
            <Link href="/settings" className="block px-4 py-2 rounded-md hover:bg-slate-800 transition">Settings</Link>
          </nav>
          <div className="p-4 border-t border-slate-800">
            <div className="text-sm text-slate-400">Active Store</div>
            <div className="font-medium truncate">demo.myshopify.com</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Navbar */}
          <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 justify-between shadow-sm">
            <h2 className="text-lg font-semibold text-gray-700">Dashboard</h2>
            <div className="flex space-x-4">
              <button className="text-sm px-4 py-2 bg-emerald-100 text-emerald-700 rounded-md font-medium">Shopify Connected</button>
            </div>
          </header>
          
          {/* Page Content */}
          <div className="flex-1 overflow-auto p-8 bg-slate-50">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}
