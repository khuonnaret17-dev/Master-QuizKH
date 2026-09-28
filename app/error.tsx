'use client';

import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('App runtime error caught:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-950/40 text-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        មានបញ្ហាបច្ចេកទេសមួយចំនួន
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-6">
        ប្រព័ន្ធបានជួបប្រទះបញ្ហាមិនរំពឹងទុក។ សូមចុចប៊ូតុងខាងក្រោមដើម្បីព្យាយាមដំណើរការឡើងវិញ។
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          ព្យាយាមម្តងទៀត
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-all"
        >
          ផ្ទុកទំព័រឡើងវិញ
        </button>
      </div>
    </div>
  );
}
