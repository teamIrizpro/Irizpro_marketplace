'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

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
}

interface PurchasedAgent {
  agent_id: string
  remaining_credits: number
}

export default function BrowseAgents() {
  const [user, setUser] = useState<User | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [purchasedAgents, setPurchasedAgents] = useState<PurchasedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUser()
    loadAgents()
    setupRealtimeSubscription()
  }, [])

  useEffect(() => {
    if (user) {
      loadPurchasedAgents()
    }
  }, [user])

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('marketplace-agents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents'
        },
        (payload) => {
          console.log('Real-time marketplace update:', payload)
          setLastUpdate(new Date())
          loadAgents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

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
      console.log('Loaded agents:', data?.length || 0)
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

  const handlePurchase = (agent: Agent) => {
    if (!user) {
      // Store agent data for after login
      localStorage.setItem('pendingPurchase', JSON.stringify({
        agent_id: agent.id,
        agent_name: agent.name,
        credit_cost: agent.credit_cost.toString(),
        new_purchase: 'true'
      }))
      router.push('/auth/login?redirect=purchase')
      return
    }

    const params = new URLSearchParams({
      agent_id: agent.id,
      agent_name: agent.name,
      credit_cost: agent.credit_cost.toString(),
      new_purchase: 'true'
    })
    router.push(`/purchase?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">◉ SCANNING MARKETPLACE ◉</div>
          <div className="text-sm">Loading neural networks...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <header className="border-b-2 border-purple-500 p-4 bg-gray-900/20">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-purple-400">◉ NEURAL AGENT MARKETPLACE ◉</h1>
            <div className="text-sm bg-purple-900/30 border border-purple-500 rounded px-2 py-1">
              <span className="text-purple-300">LIVE UPDATES</span>
            </div>
            <div className="text-sm">
              Available Agents: <span className="text-cyan-400 font-bold">{agents.length}</span>
            </div>
          </div>
          
          <nav className="flex items-center space-x-6">
            {user ? (
              <button 
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 border border-cyan-500 text-cyan-400 hover:bg-cyan-900 transition-colors"
              >
                DASHBOARD
              </button>
            ) : (
              <>
                <button 
                  onClick={() => router.push('/auth/login')}
                  className="px-4 py-2 border border-cyan-500 text-cyan-400 hover:bg-cyan-900 transition-colors"
                >
                  LOGIN
                </button>
                <button 
                  onClick={() => router.push('/auth/signup')}
                  className="px-4 py-2 border border-purple-500 text-purple-400 hover:bg-purple-900 transition-colors"
                >
                  SIGNUP
                </button>
              </>
            )}
            
            <button 
              onClick={() => router.push('/')}
              className="px-4 py-2 border border-gray-500 text-gray-400 hover:bg-gray-900 transition-colors"
            >
              HOME
            </button>
          </nav>
        </div>
      </header>

      {/* Auth Status Banner */}
      {!user && (
        <div className="bg-yellow-900/20 border-b border-yellow-500 p-3">
          <div className="container mx-auto text-center">
            <span className="text-yellow-400">
              ⚠ Not logged in - You can browse agents but need to login to purchase
            </span>
          </div>
        </div>
      )}

      {/* Real-time Status Bar */}
      <div className="bg-gray-900/30 border-b border-gray-600 p-2">
        <div className="container mx-auto flex justify-between items-center text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400">Live Marketplace</span>
            </div>
            <span className="text-gray-400">
              Last Update: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          <div className="text-gray-400">
            Showing only active agents | Admin-managed inventory
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h3 className="text-lg text-cyan-400 mb-4">◉ FILTER BY CATEGORY ◉</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 border transition-colors ${
                  selectedCategory === category
                    ? 'border-purple-400 bg-purple-900/30 text-purple-300'
                    : 'border-gray-600 text-gray-400 hover:border-purple-600 hover:text-purple-400'
                }`}
              >
                {category.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Agents Grid */}
        {filteredAgents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl text-gray-600 mb-6">🤖</div>
            <h3 className="text-2xl text-gray-400 mb-4">NO AGENTS AVAILABLE</h3>
            <p className="text-gray-500 mb-6">
              {selectedCategory === 'all' 
                ? 'No neural networks are currently active in the marketplace.' 
                : `No agents available in the "${selectedCategory}" category.`
              }
            </p>
            
            {selectedCategory !== 'all' && (
              <button 
                onClick={() => setSelectedCategory('all')}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white border-2 border-purple-400 transition-colors rounded"
              >
                VIEW ALL CATEGORIES
              </button>
            )}

            {agents.length === 0 && (
              <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-500 rounded">
                <p className="text-yellow-400 text-sm">
                  🔧 Marketplace is being updated by administrators. Check back soon for new agents!
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAgents.map((agent) => (
              <MarketplaceAgentCard
                key={agent.id}
                agent={agent}
                isPurchased={user ? isPurchased(agent.id) : false}
                remainingCredits={user ? getRemainingCredits(agent.id) : 0}
                onPurchase={() => handlePurchase(agent)}
                isLoggedIn={!!user}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface MarketplaceAgentCardProps {
  agent: Agent
  isPurchased: boolean
  remainingCredits: number
  onPurchase: () => void
  isLoggedIn: boolean
}

function MarketplaceAgentCard({ agent, isPurchased, remainingCredits, onPurchase, isLoggedIn }: MarketplaceAgentCardProps) {
  const isNew = new Date(agent.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  return (
    <div className="border-2 border-purple-500 bg-purple-900/10 hover:bg-purple-900/20 transition-all duration-300 rounded-lg p-6 relative shadow-lg hover:shadow-purple-500/20">
      {/* Status Badges */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
        {isLoggedIn && isPurchased && (
          <div className="bg-green-600 text-black px-2 py-1 text-xs font-bold rounded">
            OWNED ({remainingCredits})
          </div>
        )}
        {isNew && (
          <div className="bg-yellow-500 text-black px-2 py-1 text-xs font-bold rounded">
            NEW
          </div>
        )}
      </div>

      {/* Agent Icon/Avatar */}
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 border-2 border-purple-400 rounded flex items-center justify-center mr-4 bg-purple-900/30">
          <span className="text-xl">🤖</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-purple-400 leading-tight">{agent.name}</h3>
          <div className="text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1 mt-1 inline-block">
            {agent.category}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-4 leading-relaxed h-16 overflow-hidden">{agent.description}</p>

      {/* Pricing */}
      <div className="mb-4 p-3 bg-black/50 border border-gray-600 rounded">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-400">COST PER EXECUTION</div>
            <div className="text-yellow-400 font-bold text-lg">₹{agent.credit_cost}</div>
          </div>
          <div className="text-xs text-gray-400 text-right">
            <div>Added: {new Date(agent.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      {isLoggedIn && isPurchased ? (
        <div className="space-y-2">
          <div className="w-full py-3 bg-green-600/20 text-green-400 border border-green-500 text-center rounded font-bold">
            ✓ ALREADY PURCHASED
          </div>
          <div className="text-xs text-center text-gray-400 bg-gray-800/50 rounded p-2">
            {remainingCredits} credits remaining | Go to Dashboard to execute
          </div>
        </div>
      ) : (
        <button
          onClick={onPurchase}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold border-2 border-purple-400 transition-all rounded hover:shadow-lg hover:shadow-purple-500/30"
        >
          {isLoggedIn ? '💳 PURCHASE AGENT' : '🔐 LOGIN TO PURCHASE'}
        </button>
      )}

      {/* Technical Specs */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>NEURAL CORE:</span>
          <span className="text-cyan-400">v2.1.{Math.floor(Math.random() * 9)}</span>
        </div>
        <div className="flex justify-between">
          <span>PROCESSING:</span>
          <span className="text-green-400">{Math.floor(Math.random() * 50 + 50)}ms avg</span>
        </div>
        <div className="flex justify-between">
          <span>RELIABILITY:</span>
          <span className="text-yellow-400">{Math.floor(Math.random() * 10 + 90)}%</span>
        </div>
      </div>
    </div>
  )
}