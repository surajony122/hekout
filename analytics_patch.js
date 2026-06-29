const fs = require('fs');

let pageContent = fs.readFileSync('src/app/analytics/page.tsx', 'utf8');

// Replace Device Breakdown hardcoded data with Checkout Funnel dynamic data
const newCard = `
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Checkout Drop-off Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.funnel} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis dataKey="step" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} width={100} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [\`\${value} Users\`, 'Reached']}
                  />
                  <Bar dataKey="users" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={30}>
                     {/* We could map different colors but solid purple is nice */}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 text-center mt-4">Tracks the conversion journey of all visitors.</p>
          </CardContent>
        </Card>
`;

pageContent = pageContent.replace(/<Card className="shadow-sm border-slate-200">[\s\S]*?<CardTitle.*?Device Breakdown[\s\S]*?<\/CardContent>\s*<\/Card>/, newCard);

fs.writeFileSync('src/app/analytics/page.tsx', pageContent);
console.log('Analytics page updated with dynamic Funnel Chart!');

// Now update template_v3.js to shoot events
let templateJs = fs.readFileSync('template_v3.js', 'utf8');
const trackFunc = `
      const cfTrack = async (evt) => {
         try {
            await fetch(\`\${apiBaseUrl}/api/analytics\`, {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ shop, eventName: evt })
            });
         } catch(e){}
      };
`;

// Inject trackFunc inside open
templateJs = templateJs.replace(/const autoApplyCoupon = \(\) => \{/, trackFunc + "\n      const autoApplyCoupon = () => {");

// Inject PHONE_ENTERED
templateJs = templateJs.replace(/let verifiedPhone = '';/, "let verifiedPhone = '';\n      cfTrack('WIDGET_OPENED');"); // Fallback for WIDGET_OPENED just in case
templateJs = templateJs.replace(/const code = document.getElementById\('cf-otp-in'\).value.trim\(\);/, "const code = document.getElementById('cf-otp-in').value.trim();\n            cfTrack('PHONE_ENTERED');");

// Inject OTP_VERIFIED
templateJs = templateJs.replace(/localStorage.setItem\('checkoutflow_verified_phone', verifiedPhone\);/, "localStorage.setItem('checkoutflow_verified_phone', verifiedPhone);\n              cfTrack('OTP_VERIFIED');");

fs.writeFileSync('template_v3.js', templateJs);
console.log('Template updated to shoot events.');
