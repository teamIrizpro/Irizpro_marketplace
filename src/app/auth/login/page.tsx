'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('Attempting login with:', email) // Debug log

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Login response:', { data, error }) // Debug log

      if (error) {
        console.error('Login error:', error)
        setError(error.message)
      } else if (data.user) {
        console.log('Login successful, user:', data.user.id)
        
        // Check if user is verified
        if (!data.user.email_confirmed_at) {
          setError('Please verify your email before signing in. Check your inbox for a verification link.')
          return
        }
        
        // Redirect to dashboard
        router.push('/dashboard')
      } else {
        setError('Login failed. Please try again.')
      }
    } catch (err) {
      console.error('Unexpected login error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-gray-900 border border-cyan-500 rounded-lg p-8">
          <h1 className="text-2xl font-bold mb-6 text-center text-cyan-400">
            SYSTEM LOGIN
          </h1>

          {error && (
            <div className="bg-red-900 border border-red-500 text-red-200 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm">
            <p>
              Don't have an account?{' '}
              <a href="/auth/signup" className="text-purple-400 hover:underline">
                Create account
              </a>
            </p>
            
            <p>
              Forgot your password?{' '}
              <a href="/auth/reset" className="text-cyan-400 hover:underline">
                Reset password
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}