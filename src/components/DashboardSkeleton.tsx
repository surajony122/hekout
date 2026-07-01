import { Card, CardContent } from "@/components/ui/card";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-end">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded"></div>
          <div className="h-4 w-64 bg-slate-100 rounded mt-2"></div>
        </div>
        <div className="h-9 w-32 bg-slate-200 rounded-md"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-sm border-slate-200">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-4 w-4 bg-slate-200 rounded"></div>
              </div>
              <div className="mt-4">
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <div className="h-[400px] bg-slate-50 rounded-lg border border-slate-100 w-full flex flex-col p-6 space-y-4">
             <div className="h-6 w-48 bg-slate-200 rounded"></div>
             <div className="space-y-3 mt-4">
               {[1, 2, 3, 4, 5].map((i) => (
                 <div key={i} className="h-12 w-full bg-slate-100 rounded"></div>
               ))}
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
