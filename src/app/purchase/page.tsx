'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PurchasePage() {
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
      document.body.removeChild(script)
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

  const handlePayment = () => {
    if (!window.Razorpay) {
      alert('Razorpay not loaded. Please refresh and try again.')
      return
    }

    setLoading(true)

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Your Razorpay Key ID
      amount: Math.round(totalAmount * 100), // Amount in paise
      currency: 'INR',
      name: 'N8N Agent Marketplace',
      description: `${creditAmount} credits for ${agentName}`,
      image: '/logo.png', // Your company logo
      handler: async (response: any) => {
        try {
          // Verify payment on backend (you'll need to implement this)
          const verified = await verifyPayment(response)
          
          if (verified) {
            await addCreditsToAgent()
            router.push('/dashboard?payment=success')
          } else {
            throw new Error('Payment verification failed')
          }
        } catch (error) {
          console.error('Payment error:', error)
          alert('Payment failed. Please try again.')
        } finally {
          setLoading(false)
        }
      },
      prefill: {
        name: user?.user_metadata?.full_name || '',
        email: user?.email || '',
      },
      theme: {
        color: '#8B5CF6'
      },
      modal: {
        ondismiss: () => {
          setLoading(false)
        }
      }
    }

    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  const verifyPayment = async (paymentResponse: any) => {
    // In a real implementation, you'd verify the payment signature on your backend
    // For now, we'll simulate successful verification
    console.log('Payment response:', paymentResponse)
    return true
  }

  const addCreditsToAgent = async () => {
    try {
      if (isNewPurchase) {
        // Create new user_agent entry
        const { error } = await supabase
          .from('user_agents')
          .insert({
            user_id: user?.id,
            agent_id: agentId,
            remaining_credits: creditAmount
          })

        if (error) throw error
      } else {
        // Update existing user_agent
        const { data: currentAgent } = await supabase
          .from('user_agents')
          .select('remaining_credits')
          .eq('id', userAgentId)
          .single()

        if (currentAgent) {
          const { error } = await supabase
            .from('user_agents')
            .update({
              remaining_credits: currentAgent.remaining_credits + creditAmount
            })
            .eq('id', userAgentId)

          if (error) throw error
        }
      }

      // Log the transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: user?.id,
          agent_id: agentId,
          credits_purchased: creditAmount,
          amount_paid: totalAmount,
          payment_status: 'completed'
        })

    } catch (error) {
      console.error('Error adding credits:', error)
      throw error
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <header className="border-b-2 border-green-500 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-yellow-400">◉ PAYMENT GATEWAY ◉</h1>
          <button 
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-500 text-gray-400 hover:bg-gray-900 transition-colors"
          >
            BACK
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 max-w-2xl">
        <div className="bg-gray-900 border-2 border-yellow-500 rounded-lg p-8">
          <h2 className="text-xl text-yellow-400 mb-6 text-center">
            ◉ CREDIT PURCHASE TERMINAL ◉
          </h2>

          {/* Agent Info */}
          <div className="bg-black/50 border border-gray-600 rounded p-4 mb-6">
            <h3 className="text-lg font-bold text-cyan-400 mb-2">{agentName}</h3>
            <div className="text-sm text-gray-400">
              {isNewPurchase ? 'Initial Purchase' : 'Credit Top-up'}
            </div>
          </div>

          {/* Purchase Details */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Cost per Credit:</span>
              <span className="text-yellow-400 font-bold">₹{creditCost}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Credits to Purchase:</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCreditAmount(Math.max(1, creditAmount - 10))}
                  className="w-10 h-10 border border-gray-500 text-gray-400 hover:bg-gray-800 transition-colors"
                  disabled={loading}
                >
                  -
                </button>
                <span className="text-white font-bold text-xl w-20 text-center">
                  {creditAmount}
                </span>
                <button
                  onClick={() => setCreditAmount(creditAmount + 10)}
                  className="w-10 h-10 border border-gray-500 text-gray-400 hover:bg-gray-800 transition-colors"
                  disabled={loading}
                >
                  +
                </button>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-4">
              <div className="flex justify-between items-center text-xl">
                <span className="text-gray-400">Total Amount:</span>
                <span className="text-yellow-400 font-bold">₹{totalAmount}</span>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 text-black font-bold text-lg border-2 border-yellow-400 transition-colors"
          >
            {loading ? 'PROCESSING PAYMENT...' : 'PROCEED TO PAYMENT'}
          </button>

          {/* Security Notice */}
          <div className="mt-6 text-xs text-gray-500 text-center">
            <p>🔒 Secure payment powered by Razorpay</p>
            <p>Your payment information is encrypted and secure</p>
          </div>
        </div>

        {/* Quick Purchase Options */}
        <div className="mt-6 bg-gray-900 border border-purple-500 rounded-lg p-6">
          <h3 className="text-lg text-purple-400 mb-4">◉ QUICK PURCHASE ◉</h3>
          <div className="grid grid-cols-3 gap-3">
            {[10, 50, 100].map(amount => (
              <button
                key={amount}
                onClick={() => setCreditAmount(amount)}
                className={`py-2 px-4 border transition-colors ${
                  creditAmount === amount
                    ? 'border-purple-400 bg-purple-900/30 text-purple-300'
                    : 'border-gray-600 text-gray-400 hover:border-purple-600'
                }`}
                disabled={loading}
              >
                {amount} Credits
                <div className="text-xs">₹{amount * creditCost}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}