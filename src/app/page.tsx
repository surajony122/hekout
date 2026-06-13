import DashboardClient from './components/DashboardClient';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <>
      <DashboardClient />
      <Script src="/widget.js" strategy="lazyOnload" />
    </>
  );
}
