'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import ModernBackground from '@/components/layouts/ModernBackground'
import ModernHeader from '@/components/layouts/ModernHeader'
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency'

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Simple loading component for Suspense
function LoadingPurchase() {
  return (
    <ModernBackground>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading purchase...</p>
        </div>
      </div>
    </ModernBackground>
  )
}

// Main purchase page component
function PurchasePageContent() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [creditAmount, setCreditAmount] = useState(10)
  const searchParams = useSearchParams()
  const router = useRouter()

  const agentId = searchParams.get('agent_id') || ''
  const userAgentId = searchParams.get('user_agent_id') || ''
  const agentName = searchParams.get('agent_name') || 'Unknown Agent'
  const creditCost = parseFloat(searchParams.get('credit_cost') || '1')
  const isNewPurchase = searchParams.get('new_purchase') === 'true'
  const currency = searchParams.get('currency') || 'USD'

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUser()
    
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        document.body.removeChild(script)
      }
    }
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setUser(user)
  }

  const totalAmount = creditAmount * creditCost

  const handlePayment = async () => {
    if (!window.Razorpay) {
      alert('Razorpay not loaded. Please refresh and try again.')
      return
    }

    setLoading(true)
    console.log('🚀 Starting payment process...')

    try {
      // Create order first
      console.log('📦 Creating Razorpay order...')
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: `agent_${agentId}`,
          agentId: agentId,
          agentName: agentName,
          credits: creditAmount,
          amount: totalAmount,
          currency: currency,
          userId: user?.id
        })
      })

      const orderData = await orderResponse.json()
      console.log('📋 Order response:', orderData)
      
      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      console.log('✅ Order created successfully, opening Razorpay...')

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: Math.round(totalAmount * 100), // Amount in paise
        currency: currency,
        name: 'AI Agent Marketplace',
        description: `${creditAmount} credits for ${agentName}`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.user_metadata?.full_name || '',
          email: user?.email || '',
        },
        notes: {
          agent_id: agentId,
          agent_name: agentName,
          credits: creditAmount.toString(),
          user_id: user?.id
        },
        // **CRITICAL FIX** - Enhanced handler with better logging and error handling
        handler: async (response: any) => {
          console.log('🔥 Payment successful! Starting verification...', response)
          console.log('📋 Payment response details:', {
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature_present: !!response.razorpay_signature
          })
          
          try {
            // Call verification endpoint with detailed logging
            console.log('📡 Calling verification API...')
            const verifyResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                packageId: `agent_${agentId}`,
                amount: totalAmount,
                credits: creditAmount,
                currency: currency,
              })
            })

            console.log('📡 Verification response status:', verifyResponse.status)
            
            let verifyData
            try {
              verifyData = await verifyResponse.json()
              console.log('📋 Verification data:', verifyData)
            } catch (parseError) {
              console.error('❌ Failed to parse verification response:', parseError)
              throw new Error('Server response was not valid JSON')
            }
            
            if (verifyResponse.ok && verifyData.success) {
              console.log('✅ Verification successful! Redirecting...')
              alert('🎉 Payment successful! Agent purchased successfully. Redirecting to dashboard...')
              
              // Force redirect after a short delay
              setTimeout(() => {
                window.location.href = '/dashboard?payment=success'
              }, 1000)
            } else {
              console.error('❌ Verification failed:', verifyData)
              alert(`❌ Payment verification failed: ${verifyData.error || 'Unknown error'}. Please contact support with payment ID: ${response.razorpay_payment_id}`)
            }
          } catch (verifyError) {
            console.error('❌ Verification network error:', verifyError)
            alert(`❌ Payment verification failed due to network error. Please contact support with payment ID: ${response.razorpay_payment_id}`)
          } finally {
            // Always reset loading state
            setLoading(false)
          }
        },
        modal: {
          ondismiss: () => {
            console.log('❌ Payment modal closed by user')
            setLoading(false)
          }
        },
        theme: {
          color: '#8B5CF6'
        }
      }

      console.log('🚀 Opening Razorpay with options:', options)
      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (error) {
      console.error('❌ Payment initiation failed:', error)
      alert('Failed to initiate payment. Please try again.')
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Checking authentication...</p>
          </div>
        </div>
      </ModernBackground>
    )
  }

  return (
    <ModernBackground>
      <ModernHeader user={user} />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Purchase Credits
            </h1>
            <p className="text-gray-400 text-lg">for {agentName}</p>
          </div>

          {/* Main Purchase Card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-6">
            {/* Agent Header */}
            <div className="flex items-center mb-6 pb-6 border-b border-white/10">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{agentName}</h2>
                <div className="text-sm text-gray-400">
                  {isNewPurchase ? 'Initial Purchase' : 'Credit Top-up'}
                </div>
              </div>
            </div>

            {/* Purchase Details */}
            <div className="space-y-6 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Cost per Credit:</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">{formatCurrency(creditCost, currency)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">Credits to Purchase:</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCreditAmount(Math.max(1, creditAmount - 10))}
                    className="w-10 h-10 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                    disabled={loading}
                  >
                    −
                  </button>
                  <span className="text-white font-bold text-2xl w-20 text-center">
                    {creditAmount}
                  </span>
                  <button
                    onClick={() => setCreditAmount(creditAmount + 10)}
                    className="w-10 h-10 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                    disabled={loading}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-lg">Total Amount:</span>
                  <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">{formatCurrency(totalAmount, currency)}</span>
                </div>
              </div>
            </div>

            {/* Quick Purchase Options */}
            <div className="mb-8">
              <h3 className="text-sm text-gray-400 mb-3">Quick Select:</h3>
              <div className="grid grid-cols-3 gap-3">
                {[10, 50, 100].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setCreditAmount(amount)}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                      creditAmount === amount
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                    disabled={loading}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Button */}
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg rounded-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Payment...
                </span>
              ) : (
                'Proceed to Payment'
              )}
            </button>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-200 text-sm flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure payment powered by Razorpay
              </p>
            </div>
          </div>

          {/* Back Button */}
          <div className="text-center">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mx-auto"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Agents
            </button>
          </div>
        </div>
      </div>
    </ModernBackground>
  )
}

// Export with Suspense wrapper
export default function PurchasePage() {
  return (
    <Suspense fallback={<LoadingPurchase />}>
      <PurchasePageContent />
    </Suspense>
  )
}