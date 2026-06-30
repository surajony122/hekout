const fs = require('fs');
let file = fs.readFileSync('src/app/settings/PaymentSettingsClient.tsx', 'utf8');

// Add fields to formData
file = file.replace(
  'codFeeAmount: initialSettings.codFeeAmount !== undefined ? initialSettings.codFeeAmount : 69,',
  'codFeeAmount: initialSettings.codFeeAmount !== undefined ? initialSettings.codFeeAmount : 69,\n    shippingFeeAmount: initialSettings.shippingFeeAmount !== undefined ? initialSettings.shippingFeeAmount : 0,\n    freeShippingThreshold: initialSettings.freeShippingThreshold !== undefined ? initialSettings.freeShippingThreshold : 999,'
);

// Add Shipping Settings UI section
const uiCode = `
          {/* Shipping Settings */}
          <div className="border border-slate-100 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-2">Shipping Rules</h3>
            <p className="text-slate-500 text-xs mb-4">Set your base shipping fee and the cart value required to unlock free shipping.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Shipping Fee (₹)</label>
                <input type="number" name="shippingFeeAmount" value={formData.shippingFeeAmount} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Free Shipping Threshold (₹)</label>
                <input type="number" name="freeShippingThreshold" value={formData.freeShippingThreshold} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
`;

file = file.replace(
  '        </div>\n      </div>\n\n      <div className="flex justify-end">',
  uiCode + '\n      <div className="flex justify-end">'
);

fs.writeFileSync('src/app/settings/PaymentSettingsClient.tsx', file);
console.log('UI patched successfully!');
