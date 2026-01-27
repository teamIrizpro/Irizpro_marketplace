'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import ModernBackground from '@/components/layouts/ModernBackground'
import ModernHeader from '@/components/layouts/ModernHeader'
import {
  getUserPreferredCurrency,
  setUserPreferredCurrency,
  getPrice,
  formatCurrency,
  SUPPORTED_CURRENCIES,
  type PricingConfig
} from '@/lib/currency'

interface Agent {
  id: string
  name: string
  description: string
  credit_cost: number
  category: string
  icon_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
  pricing_config?: PricingConfig
}

interface PurchasedAgent {
  agent_id: string
  remaining_credits: number
}

export default function BrowseAgents() {
  const [user, setUser] = useState<User | null>(null)
  const [userCredits, setUserCredits] = useState<number>(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [purchasedAgents, setPurchasedAgents] = useState<PurchasedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Detect and set user's currency on mount
    const detectedCurrency = getUserPreferredCurrency()
    setSelectedCurrency(detectedCurrency)
    console.log('💱 Detected user currency:', detectedCurrency)

    checkUser()
    loadAgents()
  }, [])

  useEffect(() => {
    if (user) {
      loadPurchasedAgents()
      loadUserCredits()
    }
  }, [user])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Error loading agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPurchasedAgents = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_agents')
        .select('agent_id, remaining_credits')

      if (error) throw error
      setPurchasedAgents(data || [])
    } catch (error) {
      console.error('Error loading purchased agents:', error)
    }
  }

  const loadUserCredits = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setUserCredits(data?.credits || 0)
    } catch (error) {
      console.error('Error loading user credits:', error)
    }
  }

  const categories = ['all', ...new Set(agents.map(agent => agent.category).filter(Boolean))]
  const filteredAgents = selectedCategory === 'all' 
    ? agents 
    : agents.filter(agent => agent.category === selectedCategory)

  const isPurchased = (agentId: string) => {
    return purchasedAgents.some(pa => pa.agent_id === agentId)
  }

  const getRemainingCredits = (agentId: string) => {
    const purchased = purchasedAgents.find(pa => pa.agent_id === agentId)
    return purchased?.remaining_credits || 0
  }

  const handleCurrencyChange = (newCurrency: string) => {
    setSelectedCurrency(newCurrency)
    setUserPreferredCurrency(newCurrency)
    console.log('💱 Currency changed to:', newCurrency)
  }

  const handlePurchase = (agent: Agent) => {
    // Calculate price based on selected currency and agent's pricing_config
    const pricingConfig = agent.pricing_config || {
      basePrice: agent.credit_cost,
      customPrices: {}
    }
    const price = getPrice(pricingConfig, selectedCurrency)

    if (!user) {
      // Store agent data for after login
      localStorage.setItem('pendingPurchase', JSON.stringify({
        agent_id: agent.id,
        agent_name: agent.name,
        credit_cost: price.toString(),
        currency: selectedCurrency,
        new_purchase: 'true'
      }))
      router.push('/auth/login?redirect=purchase')
      return
    }

    const params = new URLSearchParams({
      agent_id: agent.id,
      agent_name: agent.name,
      credit_cost: price.toString(),
      currency: selectedCurrency,
      new_purchase: 'true'
    })
    router.push(`/purchase?${params.toString()}`)
  }

  if (loading) {
    return (
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-xl text-white font-medium">Loading agents...</div>
          </div>
        </div>
      </ModernBackground>
    )
  }

  return (
    <ModernBackground>
      <ModernHeader user={user} credits={userCredits} />

      {/* Main Content */}
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Discover AI Agents
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Browse our marketplace of powerful automation workflows
            </p>
          </div>

          {/* Currency Selector */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-3 justify-center items-center">
              <span className="text-sm text-gray-400 font-medium">Currency:</span>
              {Object.keys(SUPPORTED_CURRENCIES).map(currencyCode => {
                const currencyInfo = SUPPORTED_CURRENCIES[currencyCode]
                return (
                  <button
                    key={currencyCode}
                    onClick={() => handleCurrencyChange(currencyCode)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      selectedCurrency === currencyCode
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-white/5 backdrop-blur-sm border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {currencyInfo.symbol} {currencyCode}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-3 justify-center">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-300 ${
                    selectedCategory === category
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                      : 'bg-white/5 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Agents Grid */}
          {filteredAgents.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-6">🤖</div>
              <h3 className="text-2xl font-bold text-white mb-4">No Agents Found</h3>
              <p className="text-gray-400 mb-6">
                {selectedCategory === 'all'
                  ? 'No agents are currently available'
                  : `No agents found in "${selectedCategory}" category`
                }
              </p>

              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
                >
                  View All Categories
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <ModernAgentCard
                  key={agent.id}
                  agent={agent}
                  isPurchased={user ? isPurchased(agent.id) : false}
                  remainingCredits={user ? getRemainingCredits(agent.id) : 0}
                  onPurchase={() => handlePurchase(agent)}
                  isLoggedIn={!!user}
                  selectedCurrency={selectedCurrency}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ModernBackground>
  )
}

interface ModernAgentCardProps {
  agent: Agent
  isPurchased: boolean
  remainingCredits: number
  onPurchase: () => void
  isLoggedIn: boolean
  selectedCurrency: string
}

function ModernAgentCard({ agent, isPurchased, remainingCredits, onPurchase, isLoggedIn, selectedCurrency }: ModernAgentCardProps) {
  const isNew = new Date(agent.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Calculate price based on selected currency and agent's pricing_config
  const pricingConfig = agent.pricing_config || {
    basePrice: agent.credit_cost,
    customPrices: {}
  }
  const price = getPrice(pricingConfig, selectedCurrency)
  const formattedPrice = formatCurrency(price, selectedCurrency)

  return (
    <div className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/20">
      {/* Status Badges */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {isNew && (
          <div className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold rounded-full">
            New
          </div>
        )}
        {isLoggedIn && isPurchased && (
          <div className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
            Owned
          </div>
        )}
      </div>

      {/* Agent Icon */}
      <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <span className="text-2xl">🤖</span>
      </div>

      {/* Category Badge */}
      <div className="inline-block px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-medium rounded-full mb-3">
        {agent.category}
      </div>

      {/* Agent Name */}
      <h3 className="text-xl font-bold text-white mb-2 leading-tight">{agent.name}</h3>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4 line-clamp-3">{agent.description}</p>

      {/* Pricing */}
      <div className="mb-4 p-4 bg-black/30 border border-white/10 rounded-lg">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            {formattedPrice}
          </span>
          <span className="text-sm text-gray-400">/ execution</span>
        </div>
      </div>

      {/* Action Button */}
      {isLoggedIn && isPurchased ? (
        <div className="space-y-2">
          <div className="w-full py-3 bg-green-500/20 text-green-400 border border-green-500/50 text-center rounded-lg font-semibold">
            ✓ Purchased
          </div>
          <div className="text-xs text-center text-gray-400">
            {remainingCredits} credits • View in Dashboard
          </div>
        </div>
      ) : (
        <button
          onClick={onPurchase}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
        >
          {isLoggedIn ? 'Purchase Agent' : 'Sign In to Purchase'}
        </button>
      )}
    </div>
  )
}