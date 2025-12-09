'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface PurchasedAgent {
  id: string
  agent_id: string
  user_id: string
  remaining_credits: number
  created_at: string
  agent: {
    id: string
    name: string
    description: string
    credit_cost: number
    category: string
    icon_url?: string
  }
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [purchasedAgents, setPurchasedAgents] = useState<PurchasedAgent[]>([])
  const [allAgents, setAllAgents] = useState<any[]>([]) // For admin to see all agents
  const [loading, setLoading] = useState(true)
  const [executingAgent, setExecutingAgent] = useState<string | null>(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const isAdmin = user?.email === 'team@irizpro.com'

  useEffect(() => {
    checkUser()
    loadPurchasedAgents()
    if (isAdmin) {
      loadAllAgents()
    }
  }, [user])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setUser(user)
  }

  const loadPurchasedAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('user_agents')
        .select(`
          *,
          agent:agents(*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPurchasedAgents(data || [])
    } catch (error) {
      console.error('Error loading purchased agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAllAgents(data || [])
    } catch (error) {
      console.error('Error loading all agents:', error)
    }
  }

  const executeAgent = async (agentId: string, isUserAgent: boolean = true) => {
    setExecutingAgent(agentId)
    
    try {
      // Simulate agent execution
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Only decrease credits for non-admin users
      if (!isAdmin && isUserAgent) {
        const agent = purchasedAgents.find(a => a.id === agentId)
        if (agent && agent.remaining_credits > 0) {
          const { error } = await supabase
            .from('user_agents')
            .update({ remaining_credits: agent.remaining_credits - 1 })
            .eq('id', agentId)

          if (!error) {
            loadPurchasedAgents()
          }
        }
      }

      // Log execution for admin
      if (isAdmin) {
        await supabase
          .from('agent_executions')
          .insert({
            user_id: user?.id,
            agent_id: isUserAgent ? agentId : agentId,
            execution_result: 'Admin execution - no charge',
            status: 'completed'
          })
      }
    } catch (error) {
      console.error('Error executing agent:', error)
    } finally {
      setExecutingAgent(null)
    }
  }

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to remove this agent?')) return

    try {
      const { error } = await supabase
        .from('user_agents')
        .delete()
        .eq('id', agentId)

      if (!error) {
        loadPurchasedAgents()
      }
    } catch (error) {
      console.error('Error deleting agent:', error)
    }
  }

  const handlePurchaseCredits = (agent: PurchasedAgent, amount: number) => {
    const params = new URLSearchParams({
      agent_id: agent.agent_id,
      user_agent_id: agent.id,
      amount: amount.toString(),
      cost_per_credit: agent.agent.credit_cost.toString()
    })
    router.push(`/purchase?${params.toString()}`)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">◉ LOADING SYSTEM ◉</div>
          <div className="text-sm">Initializing neural networks...</div>
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
            <h1 className="text-2xl font-bold text-cyan-400">
              ◉ {isAdmin ? 'ADMIN' : 'NEURAL'} COMMAND CENTER ◉
            </h1>
            <div className="text-sm">
              USER: {user?.email} | STATUS: <span className="text-green-400">
                {isAdmin ? 'ADMIN' : 'ACTIVE'}
              </span>
            </div>
          </div>
          
          <nav className="flex items-center space-x-6">
            <button 
              onClick={() => router.push('/browse')}
              className="px-4 py-2 border border-purple-500 text-purple-400 hover:bg-purple-900 transition-colors"
            >
              BROWSE AGENTS
            </button>
            
            {isAdmin && (
              <button 
                onClick={() => router.push('/admin')}
                className="px-4 py-2 border border-red-500 text-red-400 hover:bg-red-900 transition-colors"
              >
                ADMIN PANEL
              </button>
            )}
            
            <button 
              onClick={signOut}
              className="px-4 py-2 border border-gray-500 text-gray-400 hover:bg-gray-900 transition-colors"
            >
              LOGOUT
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        {/* Admin Section - All Agents */}
        {isAdmin && (
          <div className="mb-8">
            <h2 className="text-xl text-red-400 mb-4">◉ ADMIN ACCESS - ALL AGENTS ◉</h2>
            <div className="text-sm text-yellow-400 mb-4">
              Execute any agent for FREE - No credit deduction
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {allAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="border-2 border-red-500 bg-red-900/10 hover:bg-red-900/20 transition-all duration-300 rounded-lg p-6"
                >
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 border-2 border-red-400 rounded flex items-center justify-center mr-4">
                      <span className="text-xl">👑</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-red-400">{agent.name}</h3>
                      <div className="text-xs text-gray-400">{agent.category}</div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-4">{agent.description}</p>

                  <div className="mb-4 text-center">
                    <div className="text-yellow-400 font-bold">FREE EXECUTION</div>
                    <div className="text-xs text-gray-400">Admin Privilege</div>
                  </div>

                  <button
                    onClick={() => executeAgent(agent.id, false)}
                    disabled={executingAgent === agent.id}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white border border-red-400 transition-colors"
                  >
                    {executingAgent === agent.id ? 'EXECUTING...' : 'ADMIN EXECUTE'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User's Purchased Agents */}
        <div className="mb-8">
          <h2 className="text-xl text-cyan-400 mb-2">
            ◉ {isAdmin ? 'YOUR PURCHASED AGENTS' : 'YOUR ACTIVE AGENTS'} ◉
          </h2>
          <div className="text-sm text-gray-400">
            Total Agents: {purchasedAgents.length} | Active: {purchasedAgents.filter(a => a.remaining_credits > 0).length}
          </div>
        </div>

        {purchasedAgents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl text-gray-600 mb-4">◉ ◉ ◉</div>
            <h3 className="text-xl text-gray-400 mb-4">NO AGENTS PURCHASED</h3>
            <p className="text-gray-500 mb-6">Purchase some AI agents to get started.</p>
            <button 
              onClick={() => router.push('/browse')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white border-2 border-purple-400 transition-colors"
            >
              BROWSE AGENT MARKETPLACE
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {purchasedAgents.map((userAgent) => (
              <AgentCard
                key={userAgent.id}
                userAgent={userAgent}
                executing={executingAgent === userAgent.id}
                onExecute={() => executeAgent(userAgent.id, true)}
                onDelete={() => deleteAgent(userAgent.id)}
                onPurchaseCredits={handlePurchaseCredits}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

interface AgentCardProps {
  userAgent: PurchasedAgent
  executing: boolean
  onExecute: () => void
  onDelete: () => void
  onPurchaseCredits: (userAgent: PurchasedAgent, amount: number) => void
  isAdmin: boolean
}

function AgentCard({ userAgent, executing, onExecute, onDelete, onPurchaseCredits, isAdmin }: AgentCardProps) {
  const [creditAmount, setCreditAmount] = useState(10)
  const { agent } = userAgent
  const isExhausted = userAgent.remaining_credits === 0 && !isAdmin

  const totalCost = creditAmount * agent.credit_cost

  return (
    <div className={`border-2 rounded-lg p-6 relative transition-all duration-300 ${
      isExhausted 
        ? 'border-red-500 bg-red-900/10' 
        : 'border-green-500 bg-green-900/10 hover:bg-green-900/20'
    }`}>
      {/* Admin Badge */}
      {isAdmin && (
        <div className="absolute top-4 right-4 bg-yellow-600 text-black px-2 py-1 text-xs font-bold rounded">
          ADMIN - FREE
        </div>
      )}

      {/* Agent Icon/Avatar */}
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 border-2 border-cyan-400 rounded flex items-center justify-center mr-4">
          <span className="text-xl">🤖</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-cyan-400">{agent.name}</h3>
          <div className="text-xs text-gray-400">{agent.category}</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-4 line-clamp-2">{agent.description}</p>

      {/* Credits Display */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">REMAINING CREDITS:</span>
          <span className={`font-bold ${
            isAdmin ? 'text-yellow-400' : 
            isExhausted ? 'text-red-400' : 'text-green-400'
          }`}>
            {isAdmin ? '∞ (UNLIMITED)' : userAgent.remaining_credits}
          </span>
        </div>
        
        {isExhausted && !isAdmin && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-500 rounded p-2">
            ⚠ CREDITS EXHAUSTED - REFILL REQUIRED
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {!isExhausted || isAdmin ? (
          <button
            onClick={onExecute}
            disabled={executing}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white border border-green-400 transition-colors"
          >
            {executing ? 'EXECUTING...' : (isAdmin ? 'ADMIN EXECUTE' : 'EXECUTE AGENT')}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Credit Purchase Controls */}
            <div className="flex items-center justify-between bg-black/50 border border-gray-600 rounded p-3">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCreditAmount(Math.max(1, creditAmount - 10))}
                  className="w-8 h-8 border border-gray-500 text-gray-400 hover:bg-gray-800"
                >
                  -
                </button>
                <span className="text-white font-bold w-16 text-center">{creditAmount}</span>
                <button
                  onClick={() => setCreditAmount(creditAmount + 10)}
                  className="w-8 h-8 border border-gray-500 text-gray-400 hover:bg-gray-800"
                >
                  +
                </button>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">TOTAL COST</div>
                <div className="text-yellow-400 font-bold">₹{totalCost}</div>
              </div>
            </div>

            <button
              onClick={() => onPurchaseCredits(userAgent, creditAmount)}
              className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-black font-bold border border-yellow-400 transition-colors"
            >
              PURCHASE CREDITS
            </button>
          </div>
        )}

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="w-full py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500 transition-colors"
        >
          REMOVE AGENT
        </button>
      </div>

      {/* Executing Overlay */}
      {executing && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin text-2xl mb-2">⟳</div>
            <div className="text-green-400">NEURAL PROCESSING...</div>
          </div>
        </div>
      )}
    </div>
  )
}