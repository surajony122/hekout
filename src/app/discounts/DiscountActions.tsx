"use client";

import { useState } from 'react';
import { Power, PowerOff, Edit } from 'lucide-react';

export default function DiscountActions({ id, initialStatus }: { id: string, initialStatus: boolean }) {
  const [isActive, setIsActive] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const toggleStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discounts/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });
      const data = await res.json();
      if (data.success) {
        setIsActive(!isActive);
      } else {
        alert('Failed to update status');
      }
    } catch (e) {
      alert('Error updating status');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2.5 py-1 rounded-md text-xs font-medium w-max ${isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
        {isActive ? 'Active' : 'Disabled'}
      </span>
      <button 
        onClick={toggleStatus} 
        disabled={loading}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? 'bg-emerald-500' : 'bg-slate-300'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isActive ? "Deactivate" : "Activate"}
      >
        <span className="sr-only">Toggle status</span>
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
      <a 
        href={`/discounts/${id}`}
        className="p-1.5 rounded-md transition-colors text-indigo-500 hover:bg-indigo-50"
        title="Edit & Analytics"
      >
        <Edit size={16} />
      </a>
    </div>
  );
}
