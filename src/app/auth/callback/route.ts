import { supabaseServer } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('Callback route hit with code:', code) // Debug log

  if (code) {
    try {
      const supabase = await supabaseServer()
      
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      console.log('Exchange code result:', { data, error }) // Debug log
      
      if (!error && data.user) {
        console.log('User verified successfully:', data.user.id)
        
        // Verify the user is in the auth.users table
        const { data: userData, error: userError } = await supabase
          .from('auth.users')
          .select('*')
          .eq('id', data.user.id)
          .single()
        
        console.log('User lookup result:', { userData, userError })
        
        // Redirect to dashboard on success
        const redirectUrl = new URL(next, origin)
        return NextResponse.redirect(redirectUrl.toString())
      } else {
        console.error('Email verification failed:', error)
        const redirectUrl = new URL('/auth/auth-code-error', origin)
        redirectUrl.searchParams.set('error', error?.message || 'Verification failed')
        return NextResponse.redirect(redirectUrl.toString())
      }
    } catch (err) {
      console.error('Callback error:', err)
      const redirectUrl = new URL('/auth/auth-code-error', origin)
      redirectUrl.searchParams.set('error', 'Unexpected error during verification')
      return NextResponse.redirect(redirectUrl.toString())
    }
  }

  // No code provided
  console.error('No verification code provided')
  const redirectUrl = new URL('/auth/auth-code-error', origin)
  redirectUrl.searchParams.set('error', 'No verification code provided')
  return NextResponse.redirect(redirectUrl.toString())
}