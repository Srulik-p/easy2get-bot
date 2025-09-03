'use client';

import { Suspense } from 'react';
import CustomerForm from './CustomerForm';

function CustomerFormFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerFormWrapper() {
  return (
    <Suspense fallback={<CustomerFormFallback />}>
      <CustomerForm />
    </Suspense>
  );
}
