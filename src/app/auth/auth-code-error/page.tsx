'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'An authentication error occurred'

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
      <div className="max-w-md mx-auto bg-gray-900 border border-red-500 rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-4 text-center text-red-400">
          AUTHENTICATION ERROR
        </h1>
        
        <div className="bg-red-900 border border-red-500 text-red-200 p-4 rounded mb-6">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>

        <div className="space-y-3">
          <a 
            href="/auth/signup" 
            className="block w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded text-center transition-colors"
          >
            Try Signup Again
          </a>
          
          <a 
            href="/auth/login" 
            className="block w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded text-center transition-colors"
          >
            Go to Login
          </a>
          
          <a 
            href="/" 
            className="block w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded text-center transition-colors"
          >
            Back to Home
          </a>
        </div>

        <div className="mt-6 text-sm text-gray-400">
          <p>Common issues:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Email verification link expired</li>
            <li>Account already verified</li>
            <li>Invalid verification code</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}