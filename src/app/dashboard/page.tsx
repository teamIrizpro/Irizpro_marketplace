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
    webhook_url?: string
    input_schema?: any[]
  }
}

interface ExecutionForm {
  [key: string]: string
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [purchasedAgents, setPurchasedAgents] = useState<PurchasedAgent[]>([])
  const [allAgents, setAllAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [executingAgent, setExecutingAgent] = useState<string | null>(null)
  const [showExecutionForm, setShowExecutionForm] = useState<string | null>(null)
  const [executionData, setExecutionData] = useState<ExecutionForm>({})
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const isAdmin = user?.email === 'team@irizpro.com'

  useEffect(() => {
    checkUserAndLoadData()
  }, [])

  const checkUserAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }
      
      setUser(user)
      await loadPurchasedAgents()
      
      if (user.email === 'team@irizpro.com') {
        await loadAllAgents()
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
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

  const handleExecutionFormSubmit = async (agentId: string, isUserAgent: boolean = true) => {
    const agent = isUserAgent 
      ? purchasedAgents.find(a => a.id === agentId)?.agent
      : allAgents.find(a => a.id === agentId)

    if (!agent?.webhook_url) {
      alert('This agent is not configured for execution yet.')
      return
    }

    setExecutingAgent(agentId)

    try {
      // Validate required fields
      const inputSchema = agent.input_schema || []
      const missingRequired = inputSchema
        .filter((field: any) => field.required && !executionData[field.name])
        .map((field: any) => field.label)

      if (missingRequired.length > 0) {
        alert(`Please fill in required fields: ${missingRequired.join(', ')}`)
        setExecutingAgent(null)
        return
      }

      // Call n8n webhook with user inputs
      const response = await fetch(agent.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          agent_id: agent.id,
          inputs: executionData,
          execution_id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }),
      })

      if (!response.ok) {
        throw new Error(`Webhook execution failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Deduct credits for non-admin users
      if (!isAdmin && isUserAgent) {
        const userAgent = purchasedAgents.find(a => a.id === agentId)
        if (userAgent && userAgent.remaining_credits > 0) {
          const { error } = await supabase
            .from('user_agents')
            .update({ remaining_credits: userAgent.remaining_credits - 1 })
            .eq('id', agentId)

          if (!error) {
            await loadPurchasedAgents()
          }
        }
      }

      // Log execution
      await supabase
        .from('agent_executions')
        .insert({
          user_id: user?.id,
          agent_id: agent.id,
          execution_result: JSON.stringify(result),
          status: 'completed'
        })

      // Show success message with result
      showExecutionResult(result, agent.name)
      
    } catch (error) {
      console.error('Error executing agent:', error)
      alert(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExecutingAgent(null)
      setShowExecutionForm(null)
      setExecutionData({})
    }
  }

  const showExecutionResult = (result: any, agentName: string) => {
    // Create a modal or notification to show the result
    const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4'
    modal.innerHTML = `
      <div class="bg-gray-900 border-2 border-green-500 rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
        <h3 class="text-xl text-green-400 mb-4">✅ ${agentName} - Execution Complete</h3>
        <pre class="text-green-200 bg-black p-4 rounded text-sm overflow-auto whitespace-pre-wrap">${resultText}</pre>
        <button class="mt-4 px-4 py-2 bg-green-600 text-black font-bold rounded hover:bg-green-700" onclick="document.body.removeChild(this.closest('.fixed'))">
          CLOSE
        </button>
      </div>
    `
    document.body.appendChild(modal)
  }

  const openExecutionForm = (agentId: string, agent: any) => {
    if (!agent.input_schema || agent.input_schema.length === 0) {
      // Simple execution for agents without input requirements
      handleExecutionFormSubmit(agentId)
      return
    }

    setShowExecutionForm(agentId)
    // Initialize form data with defaults
    const initialData: ExecutionForm = {}
    agent.input_schema.forEach((field: any) => {
      if (field.default) {
        initialData[field.name] = field.default
      }
    })
    setExecutionData(initialData)
  }

  const renderInputField = (field: any) => {
    const value = executionData[field.name] || ''
    const onChange = (newValue: string) => {
      setExecutionData(prev => ({ ...prev, [field.name]: newValue }))
    }

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200 h-24"
            required={field.required}
          />
        )
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
            required={field.required}
          >
            {!field.default && <option value="">Select {field.label}</option>}
            {field.options.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        )
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
            required={field.required}
          />
        )
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
        await loadPurchasedAgents()
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

      {/* Execution Form Modal */}
      {showExecutionForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-green-500 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <h3 className="text-xl text-green-400 mb-6">
              ◉ CONFIGURE AGENT EXECUTION ◉
            </h3>
            
            {(() => {
              const agent = purchasedAgents.find(a => a.id === showExecutionForm)?.agent ||
                          allAgents.find(a => a.id === showExecutionForm)
              return agent?.input_schema?.map((field: any) => (
                <div key={field.name} className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-green-300">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  {renderInputField(field)}
                  {field.description && (
                    <p className="text-xs text-gray-400 mt-1">{field.description}</p>
                  )}
                </div>
              ))
            })()}
            
            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => handleExecutionFormSubmit(showExecutionForm, purchasedAgents.some(a => a.id === showExecutionForm))}
                disabled={executingAgent === showExecutionForm}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-black font-bold border border-green-400 transition-colors"
              >
                {executingAgent === showExecutionForm ? 'EXECUTING...' : '🚀 EXECUTE AGENT'}
              </button>
              
              <button
                onClick={() => {
                  setShowExecutionForm(null)
                  setExecutionData({})
                }}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold border border-gray-400 transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

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

                  {agent.webhook_url && (
                    <div className="mb-3 text-xs bg-black/40 border border-blue-500 rounded p-2">
                      <div className="text-blue-300">n8n Ready ✓</div>
                    </div>
                  )}

                  <div className="mb-4 text-center">
                    <div className="text-yellow-400 font-bold">FREE EXECUTION</div>
                    <div className="text-xs text-gray-400">Admin Privilege</div>
                  </div>

                  <button
                    onClick={() => openExecutionForm(agent.id, agent)}
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
                onExecute={() => openExecutionForm(userAgent.id, userAgent.agent)}
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
  const hasWebhook = !!agent.webhook_url

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

      {/* n8n Status */}
      {hasWebhook && (
        <div className="mb-3 text-xs bg-black/40 border border-blue-500 rounded p-2">
          <div className="text-blue-300">n8n Integration Ready ✓</div>
        </div>
      )}

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
        
        {!hasWebhook && (
          <div className="text-xs text-orange-400 bg-orange-900/20 border border-orange-500 rounded p-2">
            ⚠ CONFIGURATION PENDING
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {(!isExhausted || isAdmin) && hasWebhook ? (
          <button
            onClick={onExecute}
            disabled={executing}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white border border-green-400 transition-colors"
          >
            {executing ? 'EXECUTING...' : (isAdmin ? 'ADMIN EXECUTE' : 'EXECUTE AGENT')}
          </button>
        ) : !hasWebhook ? (
          <div className="w-full py-2 bg-orange-600/20 text-orange-400 border border-orange-500 text-center rounded">
            SETUP PENDING
          </div>
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