// Improved Purchase Page - Auto currency detection with clean UI
// Updated src/app/purchase/page.tsx

'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { 
  SUPPORTED_CURRENCIES, 
  getUserPreferredCurrency, 
  setUserPreferredCurrency,
  formatCurrency,
  getPrice,
  PricingConfig
} from '@/lib/currency'

declare global {
  interface Window {
    Razorpay: any;
  }
}

function PurchaseContent() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [creditAmount, setCreditAmount] = useState(10)
  const [selectedCurrency, setSelectedCurrency] = useState('INR')
  const [showCurrencyOptions, setShowCurrencyOptions] = useState(false)
  const [agentPricing, setAgentPricing] = useState<PricingConfig | null>(null)
  
  const searchParams = useSearchParams()
  const router = useRouter()

  const agentId = searchParams.get('agent_id') || ''
  const userAgentId = searchParams.get('user_agent_id') || ''
  const agentName = searchParams.get('agent_name') || 'Unknown Agent'
  const isNewPurchase = searchParams.get('new_purchase') === 'true'

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUser()
    loadAgentPricing()
    
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)

    // Auto-detect user's currency (no manual selection needed initially)
    const preferredCurrency = getUserPreferredCurrency()
    setSelectedCurrency(preferredCurrency)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
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

  const loadAgentPricing = async () => {
    try {
      // Load pricing from agent configuration (set by admin during agent creation)
      const { data: agentData, error } = await supabase
        .from('agents')
        .select('pricing_config')
        .eq('id', agentId)
        .single()

      if (error) {
        console.error('Failed to load agent pricing:', error)
        // Fallback pricing if agent pricing not found
        const fallbackPricing: PricingConfig = {
          basePrice: 50, // Default ₹50 INR
        }
        setAgentPricing(fallbackPricing)
        return
      }

      // Parse pricing configuration set by admin
      const pricingConfig = agentData.pricing_config || {
        basePrice: 50,
        customPrices: {}
      }
      
      setAgentPricing(pricingConfig)
    } catch (error) {
      console.error('Failed to load agent pricing:', error)
      // Fallback pricing
      setAgentPricing({ basePrice: 50 })
    }
  }

  // Get price for current currency (no indicators shown to user)
  const creditCost = agentPricing ? getPrice(agentPricing, selectedCurrency) : 1
  const totalAmount = creditAmount * creditCost

  const handleCurrencyChange = (currency: string) => {
    setSelectedCurrency(currency)
    setUserPreferredCurrency(currency)
    setShowCurrencyOptions(false)
  }

  const handlePayment = async () => {
    if (!window.Razorpay || !agentPricing) {
      alert('Payment system not loaded. Please refresh and try again.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: `agent_${agentId}`,
          amount: totalAmount,
          credits: creditAmount,
          currency: selectedCurrency,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create payment order')
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: selectedCurrency,
        name: 'AI Agent Marketplace',
        description: `${creditAmount} credits for ${agentName}`,
        order_id: data.orderId,
        handler: async function (response: any) {
          try {
            console.log('Payment successful:', response)
            await addCreditsToAgent()
            router.push('/dashboard?payment=success')
          } catch (error) {
            console.error('Post-payment error:', error)
            alert('Payment successful, but there was an issue adding credits. Please contact support.')
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

    } catch (error: any) {
      console.error('Payment error:', error)
      alert(error.message || 'Payment failed. Please try again.')
      setLoading(false)
    }
  }

  const addCreditsToAgent = async () => {
    try {
      if (isNewPurchase) {
        const { error } = await supabase
          .from('user_agents')
          .insert({
            user_id: user?.id,
            agent_id: agentId,
            remaining_credits: creditAmount
          })
        if (error) throw error
      } else {
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
    } catch (error) {
      console.error('Error adding credits:', error)
      throw error
    }
  }

  if (!user || !agentPricing) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">◉ LOADING PURCHASE ◉</div>
          <div className="text-sm">Loading pricing information...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <header className="border-b-2 border-green-500 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-yellow-400">◉ PURCHASE CREDITS ◉</h1>
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

          {/* Current Currency Display (Auto-detected) */}
          <div className="mb-6">
            <div className="flex items-center justify-between p-4 bg-gray-800 border border-gray-600 rounded">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{SUPPORTED_CURRENCIES[selectedCurrency]?.symbol}</span>
                <div>
                  <div className="font-medium text-green-200 text-lg">{selectedCurrency}</div>
                  <div className="text-sm text-gray-400">{SUPPORTED_CURRENCIES[selectedCurrency]?.name}</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-yellow-400 font-bold text-xl">
                  {formatCurrency(creditCost, selectedCurrency)}/credit
                </div>
                <button
                  onClick={() => setShowCurrencyOptions(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline mt-1"
                >
                  Change Currency
                </button>
              </div>
            </div>
          </div>

          {/* Purchase Details */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Cost per Credit:</span>
              <span className="text-yellow-400 font-bold">
                {formatCurrency(creditCost, selectedCurrency)}
              </span>
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
                <span className="text-yellow-400 font-bold">
                  {formatCurrency(totalAmount, selectedCurrency)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 text-black font-bold text-lg border-2 border-yellow-400 transition-colors"
          >
            {loading ? 'PROCESSING PAYMENT...' : `PAY ${formatCurrency(totalAmount, selectedCurrency)}`}
          </button>

          {/* Security Notice */}
          <div className="mt-6 text-xs text-gray-500 text-center">
            <p>🔒 Secure payments powered by Razorpay</p>
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
                <div className="text-xs">
                  {formatCurrency(amount * creditCost, selectedCurrency)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Currency Selection Modal (Only shown when user clicks "Change Currency") */}
      {showCurrencyOptions && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-green-500 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl text-green-400 mb-4 text-center">
              ◉ SELECT CURRENCY ◉
            </h3>
            
            <div className="space-y-3">
              {Object.entries(SUPPORTED_CURRENCIES).map(([code, config]) => (
                <button
                  key={code}
                  onClick={() => handleCurrencyChange(code)}
                  className={`w-full p-3 border rounded transition-colors text-left ${
                    selectedCurrency === code
                      ? 'border-green-500 bg-green-900/30 text-green-300'
                      : 'border-gray-600 text-gray-400 hover:border-green-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{config.symbol}</span>
                      <div>
                        <div className="font-medium">{config.code}</div>
                        <div className="text-xs text-gray-400">{config.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-yellow-400">
                        {formatCurrency(getPrice(agentPricing!, code), code)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setShowCurrencyOptions(false)}
                className="px-4 py-2 border border-gray-500 text-gray-400 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PurchasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">◉ LOADING PURCHASE ◉</div>
          <div className="text-sm">Initializing payment system...</div>
        </div>
      </div>
    }>
      <PurchaseContent />
    </Suspense>
  )
}