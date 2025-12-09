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
  created_at: string
  is_active: boolean
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
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUser()
    loadAgents()
  }, [])

  useEffect(() => {
    if (user) {
      loadPurchasedAgents()
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

  const categories = ['all', ...new Set(agents.map(agent => agent.category))]
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
      <header className="border-b-2 border-green-500 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-purple-400">◉ AGENT MARKETPLACE ◉</h1>
            <div className="text-sm">
              Available Neural Networks: {agents.length}
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

        {filteredAgents.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl text-gray-600 mb-4">◉ ◉ ◉</div>
            <h3 className="text-xl text-gray-400 mb-4">NO AGENTS FOUND</h3>
            <p className="text-gray-500">No neural networks match your current filter.</p>
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
  return (
    <div className="border-2 border-purple-500 bg-purple-900/10 hover:bg-purple-900/20 transition-all duration-300 rounded-lg p-6 relative">
      {/* Purchase Status Badge */}
      {isLoggedIn && isPurchased && (
        <div className="absolute top-4 right-4 bg-green-600 text-black px-2 py-1 text-xs font-bold rounded">
          OWNED ({remainingCredits} CREDITS)
        </div>
      )}

      {/* Agent Icon/Avatar */}
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 border-2 border-purple-400 rounded flex items-center justify-center mr-4">
          <span className="text-xl">🤖</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-purple-400">{agent.name}</h3>
          <div className="text-xs text-gray-400">{agent.category}</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-4 h-12 overflow-hidden">{agent.description}</p>

      {/* Pricing */}
      <div className="mb-4 p-3 bg-black/50 border border-gray-600 rounded">
        <div className="text-xs text-gray-400">COST PER EXECUTION</div>
        <div className="text-yellow-400 font-bold text-lg">₹{agent.credit_cost}</div>
      </div>

      {/* Action Button */}
      {isLoggedIn && isPurchased ? (
        <div className="space-y-2">
          <div className="w-full py-2 bg-green-600/20 text-green-400 border border-green-500 text-center rounded">
            ✓ ALREADY PURCHASED
          </div>
          <div className="text-xs text-center text-gray-400">
            {remainingCredits} credits remaining
          </div>
        </div>
      ) : (
        <button
          onClick={onPurchase}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold border border-purple-400 transition-colors rounded"
        >
          {isLoggedIn ? 'PURCHASE AGENT' : 'LOGIN TO PURCHASE'}
        </button>
      )}

      {/* Technical Specs */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500">
        <div>NEURAL CORE: v2.1.{Math.floor(Math.random() * 9)}</div>
        <div>PROCESSING: {Math.floor(Math.random() * 50 + 50)}ms avg</div>
      </div>
    </div>
  )
}