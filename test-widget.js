const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM('<!DOCTYPE html><body></body>');
global.document = dom.window.document;
global.window = dom.window;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ success: true, config: {} }) });
global.navigator = { sendBeacon: () => {} };
global.MutationObserver = class { observe() {} };
require('./public/widget.js');

async function runTest() {
  try {
    await window.CheckoutFlow.open({shop:'test', items:[{variantId:1, price:100, quantity:1, title:'test'}]});
    
    // Simulate fill form
    document.getElementById('cf-addr-name').value = 'Test';
    document.getElementById('cf-addr-email').value = 'test@test.com';
    document.getElementById('cf-addr-street').value = 'Test';
    document.getElementById('cf-addr-city').value = 'Test';
    document.getElementById('cf-addr-state').value = 'Test';
    document.getElementById('cf-addr-pin').value = '123456';

    global.fetch = async (url, opts) => {
       console.log("FETCH CALLED: ", url, opts);
       return { json: async () => ({ success: true, orderStatusUrl: 'https://test' }) };
    };
    
    await window.cfExecutePayment('COD');
    console.log("Execute payment passed!");

  } catch (e) {
    console.error("Test failed with error:", e);
  }
}

runTest();
