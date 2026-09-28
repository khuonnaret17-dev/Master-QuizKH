'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Global Error captured:', error);
  }, [error]);

  return (
    <html lang="km">
      <body className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 p-4 font-sans">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center border border-gray-100">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">មានបញ្ហាខុសឆ្គងបច្ចេកទេស</h2>
          <p className="text-sm text-gray-600 mb-6">មានបញ្ហាបានកើតឡើងនៅក្នុងប្រព័ន្ធ។ សូមព្យាយាមម្តងទៀត។</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => reset()}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm"
            >
              ព្យាយាមម្តងទៀត
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
            >
              ផ្ទុកទំព័រឡើងវិញ
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
