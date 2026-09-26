'use client';

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error to avoid unused warning and aid debugging
  React.useEffect(() => {
    console.error("Global Error captured:", error);
  }, [error]);
  return (
    <html>
      <body className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 p-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">មានបញ្ហាខុសឆ្គងបច្ចេកទេស</h2>
          <p className="text-gray-600 mb-6">មានបញ្ហាបានកើតឡើងនៅក្នុងប្រព័ន្ធ។ សូមព្យាយាមម្តងទៀត។</p>
          <button
            onClick={() => reset()}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            ព្យាយាមម្តងទៀត
          </button>
        </div>
      </body>
    </html>
  );
}
