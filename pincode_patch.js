const fs = require('fs');

let js = fs.readFileSync('template_v3.js', 'utf8');

const pincodeLogic = `
      document.getElementById('cf-addr-pin').addEventListener('keyup', async (e) => {
         const val = e.target.value.trim();
         if(val.length === 6) {
            try {
               const res = await fetch(\`https://api.postalpincode.in/pincode/\${val}\`);
               const data = await res.json();
               if(data && data[0] && data[0].Status === 'Success') {
                  const postOffice = data[0].PostOffice[0];
                  document.getElementById('cf-addr-city').value = postOffice.District;
                  document.getElementById('cf-addr-state').value = postOffice.State;
               }
            } catch(err) {}
         }
      });

      document.getElementById('cf-addr-btn').onclick = () => {`;

js = js.replace(/document\.getElementById\('cf-addr-btn'\)\.onclick = \(\) => \{/, pincodeLogic);

fs.writeFileSync('template_v3.js', js);
console.log('Pincode logic added.');
