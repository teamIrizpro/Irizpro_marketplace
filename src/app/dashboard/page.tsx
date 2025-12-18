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
  // New state variables for improved execution handling
  const [executionLoading, setExecutionLoading] = useState(false)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [executionStatus, setExecutionStatus] = useState('')
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)
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

  // Updated section for src/app/dashboard/page.tsx
// Replace the existing handleExecutionFormSubmit function with this:
// Replace the handleExecutionFormSubmit function in src/app/dashboard/page.tsx
// This fixes the UI state resetting too quickly

const handleExecutionFormSubmit = async (agentId: string, isUserAgent: boolean = true) => {
  const agent = isUserAgent 
    ? purchasedAgents.find(a => a.id === agentId)?.agent
    : allAgents.find(a => a.id === agentId)

  if (!agent?.webhook_url) {
    alert('This agent is not configured for execution yet.')
    return
  }

  // Generate unique execution ID
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`🚀 Starting execution ${executionId} for agent:`, agent.name)

  // Set loading state - DON'T reset until actually complete
  setExecutionLoading(true)
  setExecutionResult(null)
  setExecutionError(null)
  setExecutionProgress(0)
  setExecutionStatus('Connecting to progress stream...')
  setExecutingAgent(agentId)

  let hasReceivedProgress = false
  let executionCompleted = false

  // Set up Server-Sent Events connection FIRST
  console.log(`📡 Connecting to SSE: /api/execution-progress/${executionId}`)
  
  const eventSource = new EventSource(
    `${window.location.origin}/api/execution-progress/${executionId}`
  )

  eventSource.onopen = () => {
    console.log('✅ SSE connection established')
    setExecutionStatus('Progress stream connected...')
  }

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('📊 Progress update received:', data)
      
      hasReceivedProgress = true

      if (data.error) {
        console.error('❌ Execution error received:', data.error)
        setExecutionError(data.error)
        setExecutionLoading(false)
        setExecutingAgent(null)
        executionCompleted = true
        eventSource.close()
        
      } else if (data.result || data.status === 'completed' || data.progress >= 100) {
        console.log('✅ Execution completed with result')
        
        if (data.result) {
          setExecutionResult(data.result)
          showExecutionResult(data.result, agent.name)
        }
        
        setExecutionStatus('Workflow completed successfully!')
        setExecutionProgress(100)
        setExecutionLoading(false)
        setExecutingAgent(null)
        executionCompleted = true
        eventSource.close()
        
      } else {
        // Regular progress update
        if (data.progress !== undefined && data.progress >= 0) {
          console.log(`📈 Progress: ${data.progress}%`)
          setExecutionProgress(data.progress)
        }
        if (data.status || data.message) {
          const statusMsg = data.message || data.status || 'Processing...'
          console.log(`📝 Status: ${statusMsg}`)
          setExecutionStatus(statusMsg)
        }
      }
    } catch (parseError) {
      console.error('❌ Error parsing progress data:', parseError, event.data)
    }
  }

  eventSource.onerror = (error) => {
    console.error('❌ SSE connection error:', error)
    
    if (!executionCompleted) {
      // Only show error if we haven't completed and haven't received any progress
      setTimeout(() => {
        if (!hasReceivedProgress && !executionCompleted) {
          console.log('⚠️ No progress received, showing connection error')
          setExecutionError('Lost connection to progress updates')
          setExecutionLoading(false)
          setExecutingAgent(null)
        }
      }, 10000) // Wait 10 seconds before giving up
    }
    
    eventSource.close()
  }

  try {
    // Validate required fields
    const inputSchema = agent.input_schema || []
    const missingRequired = inputSchema
      .filter((field: any) => field.required && !executionData[field.name])
      .map((field: any) => field.label)

    if (missingRequired.length > 0) {
      alert(`Please fill in required fields: ${missingRequired.join(', ')}`)
      setExecutingAgent(null)
      setExecutionLoading(false)
      eventSource.close()
      return
    }

    console.log('📤 Sending workflow execution request...')
    setExecutionStatus('Starting workflow execution...')

    // Call n8n webhook with execution ID for progress tracking
    const webhookPayload = {
      user_id: user?.id,
      agent_id: agent.id,
      inputs: executionData,
      execution_id: executionId,
      progress_webhook_url: `${window.location.origin}/api/execution-progress/${executionId}`
    }

    console.log('📤 Webhook payload:', webhookPayload)

    const response = await fetch(agent.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    })

    if (!response.ok) {
      throw new Error(`Webhook execution failed: ${response.status} ${response.statusText}`)
    }

    console.log('✅ Webhook called successfully, waiting for progress updates...')
    setExecutionStatus('Workflow initiated, processing...')

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
          console.log('💳 Credits deducted successfully')
        }
      }
    }

    // Log execution start
    await supabase
      .from('agent_executions')
      .insert({
        user_id: user?.id,
        agent_id: agent.id,
        execution_result: JSON.stringify({ status: 'started', execution_id: executionId }),
        status: 'running'
      })

    // DON'T reset state here - let the progress updates handle it
    console.log('🎯 Execution setup complete, monitoring progress...')

  } catch (error) {
    console.error('❌ Error executing agent:', error)
    setExecutionError(error instanceof Error ? error.message : 'Unknown error')
    setExecutionLoading(false)
    setExecutingAgent(null)
    eventSource.close()
  }

  // DON'T reset form state here - do it only when execution truly completes
  // The SSE handlers above will manage the state properly
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
      // Simplified Execution Modal Component
      // Replace your execution modal section with this clean version

    {/* Simplified Execution Modal */}
{showExecutionForm && (
  <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-900 border-2 border-green-500 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
      
      {/* Modal Header */}
      <div className="border-b border-green-500 border-opacity-30 p-6 bg-gray-800 bg-opacity-50">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-2xl text-green-400 font-bold mb-2">
              ◉ AGENT EXECUTION TERMINAL ◉
            </h3>
            <p className="text-gray-300 text-sm">
              Configure parameters and execute your neural agent
            </p>
          </div>
          
          {!executionLoading && (
            <button
              onClick={() => {
                setShowExecutionForm(null)
                setExecutionData({})
              }}
              className="text-gray-400 hover:text-red-400 text-2xl transition-colors duration-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      {executionLoading && (
        <div className="p-6 border-b border-green-500 border-opacity-30 bg-black bg-opacity-40">
          
          {/* Agent Processing Header */}
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 border-2 border-cyan-400 rounded-full flex items-center justify-center mr-4 bg-cyan-900 bg-opacity-30">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <h4 className="text-lg font-bold text-cyan-400">Neural Processing Active</h4>
              <p className="text-sm text-gray-400">Advanced AI agent execution in progress</p>
            </div>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="space-y-4">
            <div className="relative">
              {/* Background Track */}
              <div className="w-full bg-gray-800 rounded-full h-6 overflow-hidden border border-gray-600">
                {/* Progress Fill */}
                <div 
                  className="h-full transition-all duration-1000 ease-out rounded-full relative"
                  style={{ 
                    width: `${executionProgress}%`,
                    background: executionProgress > 0 ? 
                      'linear-gradient(90deg, #10B981, #06B6D4, #8B5CF6)' : 
                      'transparent',
                    boxShadow: executionProgress > 0 ? '0 0 10px rgba(34, 197, 94, 0.5)' : 'none'
                  }}
                >
                  {/* Progress Text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {executionProgress}%
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Completion Indicator */}
              {executionProgress === 100 && (
                <div className="absolute -right-2 -top-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm animate-bounce">
                    ✓
                  </div>
                </div>
              )}
            </div>
            
            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-800 bg-opacity-50 rounded-lg p-3 border border-gray-600">
                <div className="text-gray-400 mb-1">Progress</div>
                <div className="text-2xl font-bold text-cyan-400">{executionProgress}%</div>
              </div>
              <div className="bg-gray-800 bg-opacity-50 rounded-lg p-3 border border-gray-600">
                <div className="text-gray-400 mb-1">Status</div>
                <div className="text-sm font-medium text-green-300 truncate">
                  {executionStatus || 'Processing...'}
                </div>
              </div>
            </div>
            
            {/* Processing Indicator */}
            <div className="flex items-center justify-center space-x-2 py-2">
              <div className="flex items-center space-x-1">
                <span className="text-yellow-400 text-sm">◉</span>
                <span className="text-yellow-300 text-sm font-mono">NEURAL</span>
              </div>
              
              <div className="flex space-x-1">
                <div className="w-2 h-4 bg-yellow-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-4 bg-yellow-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-4 bg-yellow-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
              
              <div className="flex items-center space-x-1">
                <span className="text-cyan-300 text-sm font-mono">PROCESSING</span>
                <span className="text-cyan-400 text-sm">◉</span>
              </div>
            </div>
            
            {/* Time Estimation */}
            {executionProgress > 10 && executionProgress < 100 && (
              <div className="text-center text-xs text-gray-500">
                Estimated completion: {Math.round((100 - executionProgress) * 2)} seconds remaining
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="p-6 max-h-96 overflow-y-auto">
        {(() => {
          const agent = purchasedAgents.find(a => a.id === showExecutionForm)?.agent ||
                      allAgents.find(a => a.id === showExecutionForm)
          
          if (!agent?.input_schema || agent.input_schema.length === 0) {
            return (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🚀</div>
                <h4 className="text-xl text-cyan-400 mb-2">Ready to Execute</h4>
                <p className="text-gray-400">This agent requires no additional parameters.</p>
              </div>
            )
          }

          return (
            <div className="space-y-6">
              <div className="text-sm text-gray-400 mb-4">
                Configure the following parameters for optimal results:
              </div>
              
              {agent.input_schema.map((field: any) => (
                <div key={field.name} className="space-y-2">
                  <label className="flex items-center space-x-2 text-green-300 font-medium">
                    <span>{field.label}</span>
                    {field.required && <span className="text-red-400">*</span>}
                    <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                      {field.type}
                    </div>
                  </label>
                  
                  <div className="relative">
                    {renderInputField(field)}
                    {field.placeholder && (
                      <div className="text-xs text-gray-500 mt-1">
                        💡 {field.placeholder}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Action Buttons */}
      <div className="border-t border-green-500 border-opacity-30 p-6 bg-gray-800 bg-opacity-30">
        <div className="flex justify-between items-center">
          {!executionLoading && (
            <button
              onClick={() => {
                setShowExecutionForm(null)
                setExecutionData({})
              }}
              className="px-6 py-3 border border-gray-500 text-gray-400 hover:bg-gray-800 transition-all duration-200 rounded"
            >
              CANCEL
            </button>
          )}
          
          {executionLoading && (
            <div className="text-gray-400 text-sm">
              Please wait while the agent processes your request...
            </div>
          )}

          <button
            onClick={() => handleExecutionFormSubmit(showExecutionForm, purchasedAgents.some(a => a.id === showExecutionForm))}
            disabled={executionLoading}
            className={`px-8 py-3 font-bold rounded transition-all duration-300 ${
              executionLoading
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-black shadow-lg hover:shadow-xl hover:scale-105'
            }`}
          >
            {executionLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin text-xl">⟳</div>
                <span>EXECUTING...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span>🚀</span>
                <span>EXECUTE AGENT</span>
              </div>
            )}
          </button>
        </div>
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