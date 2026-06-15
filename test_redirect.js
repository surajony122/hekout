async function run() {
  const res = await fetch('https://httpstat.us/303', {
    redirect: 'manual'
  });
  console.log('Status:', res.status);
  console.log('Location header:', res.headers.get('location'));
}
run();
