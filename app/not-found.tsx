import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] text-slate-900 dark:text-white p-6 font-sans">
      <h1 className="text-4xl font-extrabold mb-2">404 - Page Not Found</h1>
      <p className="text-slate-500 mb-6 font-medium">The requested page could not be located.</p>
      <Link href="/" className="px-6 py-3 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-colors">
        Return to POS Home
      </Link>
    </div>
  );
}
