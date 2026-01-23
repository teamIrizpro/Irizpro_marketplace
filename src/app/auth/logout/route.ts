import { supabaseServer } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url)

  try {
    const supabase = await supabaseServer()

    // Sign out the user
    await supabase.auth.signOut()

    // Redirect to landing page
    return NextResponse.redirect(`${origin}/`, {
      status: 303, // Use 303 See Other for POST redirects
    })
  } catch (error) {
    console.error('Logout error:', error)
    // Even if there's an error, redirect to landing page
    return NextResponse.redirect(`${origin}/`, {
      status: 303,
    })
  }
}
