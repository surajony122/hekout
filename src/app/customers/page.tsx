import { prisma } from '@/lib/prisma';

export default async function CustomersPage() {
  let customers: any[] = [];
  try {
    customers = await prisma.customerProfile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  } catch (err) {
    // Return empty list if DB isn't ready
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Customers</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <input 
            type="text" 
            placeholder="Search by name, phone, or email..." 
            className="w-full max-w-md px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500">
                <th className="p-4">Name</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Email</th>
                <th className="p-4">Location</th>
                <th className="p-4">Joined</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No customers found. 
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-800">{customer.name}</td>
                    <td className="p-4 text-slate-600">{customer.phone}</td>
                    <td className="p-4 text-slate-600">{customer.email || '-'}</td>
                    <td className="p-4 text-slate-600">{customer.city}, {customer.state}</td>
                    <td className="p-4 text-slate-500">{new Date(customer.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
