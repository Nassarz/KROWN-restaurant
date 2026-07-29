'use client';
export default function GlobalError() {
  return (
    <html>
      <body>
        <div className="flex h-screen items-center justify-center bg-gray-100">
          <h1 className="text-4xl font-bold">A fatal error occurred</h1>
        </div>
      </body>
    </html>
  );
}
