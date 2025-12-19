'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

// Add proper agent pricing interface
interface Agent {
  id: string
  name: string
  description: string
  credit_cost: number
  category: string
  pricing_config?: {
    basePrice: number
    customPrices?: { [currency: string]: number }
  }
}

// Currency configuration
const CURRENCIES = {
  INR: { symbol: '₹', name: 'Indian Rupee', rate: 1 },
  USD: { symbol: '$', name: 'US Dollar', rate: 0.012 },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', rate: 0.044 },
  EUR: { symbol: '€', name: 'Euro', rate: 0.011 }
}

// Helper functions
function getAgentPrice(agent: Agent, currency: string = 'INR'): number {
  if (agent.pricing_config) {
    if (agent.pricing_config.customPrices && agent.pricing_config.customPrices[currency]) {
      return agent.pricing_config.customPrices[currency]
    }
    
    if (currency === 'INR') {
      return agent.pricing_config.basePrice
    }
    
    const rate = CURRENCIES[currency as keyof typeof CURRENCIES]?.rate || 1
    return Math.round(agent.pricing_config.basePrice * rate * 100) / 100
  }
  
  const basePrice = agent.credit_cost || 50
  if (currency === 'INR') return basePrice
  
  const rate = CURRENCIES[currency as keyof typeof CURRENCIES]?.rate || 1
  return Math.round(basePrice * rate * 100) / 100
}

function detectUserCurrency(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    if (timezone.includes('Asia/Kolkata') || timezone.includes('Asia/Delhi')) return 'INR'
    if (timezone.includes('Asia/Dubai')) return 'AED'
    if (timezone.includes('America/')) return 'USD'
    if (timezone.includes('Europe/')) return 'EUR'
    
    return 'INR'
  } catch {
    return 'INR'
  }
}

function formatCurrency(amount: number, currency: string): string {
  const config = CURRENCIES[currency as keyof typeof CURRENCIES]
  if (!config) return `${amount} ${currency}`
  
  return `${config.symbol}${amount.toFixed(2)}`
}

export default function PurchasePage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [selectedCredits, setSelectedCredits] = useState(1)
  const [userCurrency, setUserCurrency] = useState('INR')
  const [loading, setLoading] = useState(true)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    setUserCurrency(detectUserCurrency())
    loadAgent()
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        // Store purchase intent and redirect to login
        const urlParams = new URLSearchParams(window.location.search)
        const purchaseData = {
          agent_id: urlParams.get('agent_id'),
          agent_name: urlParams.get('agent_name'),
          credit_cost: urlParams.get('credit_cost'),
          new_purchase: urlParams.get('new_purchase')
        }
        localStorage.setItem('pendingPurchase', JSON.stringify(purchaseData))
        router.push('/auth/login?redirect=purchase')
        return
      }
      
      setUser(user)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/auth/login?redirect=purchase')
    }
  }

  const loadAgent = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const agentId = urlParams.get('agent_id')
      
      if (!agentId) {
        throw new Error('Agent ID not found')
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single()

      if (error) throw error
      setAgent(data)
    } catch (error) {
      console.error('Error loading agent:', error)
    } finally {
      setLoading(false)
    }
  }

  const incrementCredits = () => {
    setSelectedCredits(prev => prev + 1)
  }

  const decrementCredits = () => {
    setSelectedCredits(prev => Math.max(1, prev - 1))
  }

  const handleCreditChange = (value: string) => {
    const num = parseInt(value) || 1
    setSelectedCredits(Math.max(1, num))
  }

  const handlePayment = async () => {
    if (!agent || !user) {
      alert('Please log in to continue with payment')
      return
    }

    setPaymentProcessing(true)

    try {
      // Only process INR payments via Razorpay for now
      if (userCurrency !== 'INR') {
        alert('Payment currently only available in INR. Please contact support for other currencies.')
        return
      }

      const agentPrice = getAgentPrice(agent, userCurrency)
      const totalAmount = agentPrice * selectedCredits

      // Create Razorpay order
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: `agent_${agent.id}`,
          amount: totalAmount,
          credits: selectedCredits
        })
      })

      const orderData = await orderResponse.json()
      
      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create payment order')
      }

      // Initialize Razorpay
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: totalAmount * 100, // Convert to paise
        currency: 'INR',
        name: 'AI Agent Marketplace',
        description: `${selectedCredits} credits for ${agent.name}`,
        order_id: orderData.orderId,
        prefill: {
          email: user.email,
          name: user.user_metadata?.full_name || user.email
        },
        notes: {
          agent_id: agent.id,
          agent_name: agent.name,
          credits: selectedCredits.toString(),
          user_id: user.id
        },
        handler: async function (response: any) {
          try {
            // Verify payment on server
            const verifyResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
            })

            const verifyData = await verifyResponse.json()
            
            if (verifyResponse.ok) {
              alert('✅ Payment successful! Credits added to your account.')
              router.push('/dashboard')
            } else {
              throw new Error(verifyData.error || 'Payment verification failed')
            }
          } catch (error) {
            console.error('Payment verification error:', error)
            alert('❌ Payment verification failed. Please contact support.')
          }
        },
        modal: {
          ondismiss: function() {
            console.log('Payment modal closed')
          }
        }
      }

      // Load Razorpay script if not already loaded
      if (!(window as any).Razorpay) {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => {
          const rzp = new (window as any).Razorpay(options)
          rzp.open()
        }
        document.head.appendChild(script)
      } else {
        const rzp = new (window as any).Razorpay(options)
        rzp.open()
      }
      
    } catch (error) {
      console.error('Payment error:', error)
      alert('❌ Payment failed. Please try again.')
    } finally {
      setPaymentProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mb-4"></div>
          <p className="text-white text-lg">Loading purchase details...</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
          <p className="mb-4">The agent you're trying to purchase could not be found.</p>
          <button 
            onClick={() => router.push('/browse')}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
          >
            Browse Agents
          </button>
        </div>
      </div>
    )
  }

  const agentPrice = getAgentPrice(agent, userCurrency)
  const totalAmount = agentPrice * selectedCredits
  const currencyConfig = CURRENCIES[userCurrency as keyof typeof CURRENCIES]

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-gray-900 to-black text-white p-6">
      <div className="max-w-md mx-auto">
        <div className="bg-gray-800 border border-yellow-500 rounded-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-yellow-400">◉ CREDIT PURCHASE TERMINAL ◉</h1>
            <p className="text-gray-300 text-sm mt-2">Secure AI agent activation</p>
          </div>

          {/* Agent Info */}
          <div className="bg-gray-700 rounded p-4 mb-6">
            <h2 className="text-lg font-bold text-cyan-400">{agent.name}</h2>
            <p className="text-gray-300 text-sm">{agent.category} • Initial Purchase</p>
            <p className="text-xs text-gray-400 mt-2">{agent.description}</p>
          </div>

          {/* Currency Display - FIXED: No selector, just display */}
          <div className="bg-gray-700 rounded p-4 mb-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="text-center">
                <div className="text-2xl">{currencyConfig.symbol}</div>
                <div className="text-sm font-medium text-green-400">{userCurrency}</div>
                <div className="text-xs text-gray-400">{currencyConfig.name}</div>
              </div>
              <div className="text-gray-500">•</div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Auto-detected</div>
                <div className="text-xs text-cyan-400">Your Region</div>
              </div>
            </div>
          </div>

          {/* Pricing Display */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between">
              <span>Cost per Credit:</span>
              <span className="text-yellow-400 font-bold">
                {formatCurrency(agentPrice, userCurrency)}/credit
              </span>
            </div>

            {/* Credit Counter */}
            <div className="flex justify-between items-center">
              <span>Credits to Purchase:</span>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={decrementCredits}
                  className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded flex items-center justify-center text-lg font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={selectedCredits}
                  onChange={(e) => handleCreditChange(e.target.value)}
                  className="w-16 text-center bg-gray-700 border border-gray-600 rounded px-2 py-1"
                  min="1"
                />
                <button 
                  onClick={incrementCredits}
                  className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded flex items-center justify-center text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Total Amount */}
            <div className="flex justify-between text-lg font-bold border-t border-gray-600 pt-4">
              <span>Total Amount:</span>
              <span className="text-yellow-400">
                {formatCurrency(totalAmount, userCurrency)}
              </span>
            </div>
          </div>

          {/* Payment Button */}
          <button 
            onClick={handlePayment}
            disabled={paymentProcessing || !user}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-4 rounded-lg text-lg transition-colors"
          >
            {paymentProcessing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                <span>PROCESSING...</span>
              </div>
            ) : !user ? (
              'LOGIN REQUIRED'
            ) : (
              `PAY ${formatCurrency(totalAmount, userCurrency)}`
            )}
          </button>

          {/* Login message for non-authenticated users */}
          {!user && (
            <div className="mt-4 text-center text-sm text-gray-400">
              <p>Please log in to complete your purchase</p>
              <button
                onClick={() => router.push('/auth/login?redirect=purchase')}
                className="text-cyan-400 hover:underline mt-1"
              >
                Login here
              </button>
            </div>
          )}

          {/* Security notice */}
          <div className="text-center mt-4">
            <p className="text-xs text-gray-500">
              🔒 Secure payments powered by Razorpay
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Credits will be added instantly after payment
            </p>
          </div>
        </div>

        {/* Quick Purchase Section */}
        <div className="mt-6 bg-gray-800 border border-purple-500 rounded-lg p-6">
          <h3 className="text-lg font-bold text-purple-400 mb-4">◉ QUICK PURCHASE ◉</h3>
          <div className="grid grid-cols-3 gap-3">
            {[10, 50, 100].map(credits => (
              <button
                key={credits}
                onClick={() => setSelectedCredits(credits)}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  selectedCredits === credits
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300'
                }`}
              >
                {credits} Credits
              </button>
            ))}
          </div>
          <div className="text-center mt-3 text-xs text-gray-400">
            Popular credit packages for extended usage
          </div>
        </div>

        {/* Back to browse */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/browse')}
            className="text-gray-400 hover:text-cyan-400 text-sm transition-colors"
          >
            ← Back to Agent Marketplace
          </button>
        </div>
      </div>
    </div>
  )
}