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
  webhook_url?: string
  input_schema?: any[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    credit_cost: 1,
    category: '',
    webhook_url: '',
    input_schema: '',
    is_active: true
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkAdmin()
    loadAgents()
    setupRealtimeSubscription()
  }, [])

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-agents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents'
        },
        (payload) => {
          console.log('Real-time agent update:', payload)
          loadAgents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== 'team@irizpro.com') {
      router.push('/dashboard')
      return
    }
    setUser(user)
  }

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Error loading agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Parse input schema if provided
      let parsedInputSchema = null
      if (formData.input_schema.trim()) {
        try {
          parsedInputSchema = JSON.parse(formData.input_schema)
        } catch (error) {
          alert('Invalid JSON in input schema. Please check the format.')
          setSubmitting(false)
          return
        }
      }

      const { error } = await supabase
        .from('agents')
        .insert([{
          ...formData,
          input_schema: parsedInputSchema
        }])

      if (error) throw error

      // Reset form
      setFormData({
        name: '',
        description: '',
        credit_cost: 1,
        category: '',
        webhook_url: '',
        input_schema: '',
        is_active: true
      })

      setShowForm(false)
      showNotification('Agent deployed successfully!', 'success')
    } catch (error) {
      console.error('Error adding agent:', error)
      showNotification('Error deploying agent. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleAgentStatus = async (agentId: string, currentStatus: boolean) => {
    setActionLoading(agentId)
    
    try {
      const { error } = await supabase
        .from('agents')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)

      if (error) throw error
      
      showNotification(
        `Agent ${!currentStatus ? 'activated' : 'deactivated'} successfully!`, 
        'success'
      )
    } catch (error) {
      console.error('Error updating agent status:', error)
      showNotification('Error updating agent status.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const deleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`⚠️ DANGER ZONE ⚠️\n\nAre you sure you want to PERMANENTLY DELETE "${agentName}"?\n\nThis action will:\n- Remove the agent from the marketplace\n- Delete all user purchases of this agent\n- Remove all execution history\n\nThis CANNOT be undone!`)) {
      return
    }

    setActionLoading(agentId)

    try {
      // First delete related records
      await supabase.from('agent_executions').delete().eq('agent_id', agentId)
      await supabase.from('user_agents').delete().eq('agent_id', agentId)
      
      // Then delete the agent
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId)

      if (error) throw error
      
      showNotification('Agent permanently deleted!', 'success')
    } catch (error) {
      console.error('Error deleting agent:', error)
      showNotification('Error deleting agent.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const showNotification = (message: string, type: 'success' | 'error') => {
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg border-2 font-mono text-sm ${
      type === 'success' 
        ? 'bg-green-900 border-green-400 text-green-300' 
        : 'bg-red-900 border-red-400 text-red-300'
    }`
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 3000)
  }

  const fillSampleData = () => {
    setFormData({
      name: 'SEO Content Generator',
      description: 'AI-powered SEO blog content generator that creates optimized articles',
      credit_cost: 5,
      category: 'AI Content',
      webhook_url: 'https://n8n.irizpro.com/webhook/5b1c4b52-59d1-42a3-b8ad-c7a50350bdc2',
      input_schema: JSON.stringify([
        {
          "name": "topic",
          "type": "text",
          "label": "Content Topic",
          "required": true,
          "description": "Main topic for your blog post",
          "placeholder": "e.g., Best Project Management Tools"
        },
        {
          "name": "target_keywords",
          "type": "textarea",
          "label": "Target Keywords",
          "required": true,
          "description": "Comma-separated keywords",
          "placeholder": "seo, content, blog writing"
        },
        {
          "name": "word_count",
          "type": "select",
          "label": "Word Count",
          "options": ["1000", "1500", "2000"],
          "default": "1500",
          "required": true
        }
      ], null, 2),
      is_active: true
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">◉ ADMIN ACCESS ◉</div>
          <div className="text-sm">Verifying credentials...</div>
        </div>
      </div>
    )
  }

  const categories = [...new Set(agents.map(agent => agent.category).filter(Boolean))]

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <header className="border-b-2 border-red-500 p-4 bg-gray-900/20">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-red-400">◉ AGENT ADMIN PANEL ◉</h1>
            <div className="text-sm bg-red-900/30 border border-red-500 rounded px-2 py-1">
              <span className="text-red-300">REAL-TIME MONITORING</span>
            </div>
            <div className="text-sm">
              Total: <span className="text-cyan-400 font-bold">{agents.length}</span> | 
              Active: <span className="text-green-400 font-bold">{agents.filter(a => a.is_active).length}</span> |
              With n8n: <span className="text-blue-400 font-bold">{agents.filter(a => a.webhook_url).length}</span>
            </div>
          </div>
          
          <nav className="flex items-center space-x-6">
            <button 
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 border border-green-500 text-green-400 hover:bg-green-900 transition-colors"
            >
              {showForm ? '✕ CANCEL' : '+ DEPLOY AGENT'}
            </button>
            
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-cyan-500 text-cyan-400 hover:bg-cyan-900 transition-colors"
            >
              DASHBOARD
            </button>

            <button 
              onClick={() => router.push('/browse')}
              className="px-4 py-2 border border-purple-500 text-purple-400 hover:bg-purple-900 transition-colors"
            >
              VIEW MARKETPLACE
            </button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {/* Add Agent Form */}
        {showForm && (
          <div className="mb-8 bg-gray-900 border-2 border-green-500 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl text-green-400">◉ DEPLOY NEW AGENT ◉</h2>
              <button 
                onClick={fillSampleData}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                FILL SAMPLE DATA
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-green-300">Agent Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
                  placeholder="e.g., SEO Content Analyzer"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-green-300">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="AI Content">AI Content</option>
                  <option value="Data Processing">Data Processing</option>
                  <option value="Automation">Automation</option>
                  <option value="Research">Research</option>
                  <option value="SEO & Marketing">SEO & Marketing</option>
                  <option value="E-commerce">E-commerce</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-green-300">Credit Cost</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={formData.credit_cost}
                  onChange={(e) => setFormData({...formData, credit_cost: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
                  required
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-4 h-4 text-green-500"
                  />
                  <span className="text-sm text-green-300">Active in Marketplace</span>
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2 text-green-300">n8n Webhook URL</label>
                <input
                  type="url"
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
                  placeholder="https://n8n.irizpro.com/webhook/your-webhook-id"
                />
                <p className="text-xs text-gray-400 mt-1">Required for agent execution. Leave empty if not ready.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2 text-green-300">Input Schema (JSON)</label>
                <textarea
                  value={formData.input_schema}
                  onChange={(e) => setFormData({...formData, input_schema: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200 font-mono text-xs h-40"
                  placeholder='[{"name": "topic", "type": "text", "label": "Topic", "required": true}]'
                />
                <p className="text-xs text-gray-400 mt-1">JSON array defining input fields for the execution form. Leave empty for simple execution.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2 text-green-300">Agent Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none h-24 text-green-200"
                  placeholder="Describe what this agent does, its benefits, and capabilities..."
                  required
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-black font-bold border border-green-400 transition-colors"
                >
                  {submitting ? '🚀 DEPLOYING AGENT...' : '🚀 DEPLOY TO MARKETPLACE'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Agents List */}
        <div className="bg-gray-900 border-2 border-red-500 rounded-lg p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl text-red-400">◉ AGENT REGISTRY ◉</h2>
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400">LIVE MONITORING</span>
              </div>
            </div>
          </div>

          {agents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-4">🤖</div>
              <div className="text-lg">No agents in the system</div>
              <div className="text-sm mt-2">Deploy your first agent to get started</div>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`border-2 rounded-lg p-6 transition-all duration-300 ${
                    agent.is_active 
                      ? 'border-green-500 bg-green-900/10 shadow-green-500/20' 
                      : 'border-gray-600 bg-gray-800/10 shadow-gray-500/20'
                  } shadow-lg hover:shadow-xl`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-bold text-cyan-400">{agent.name}</h3>
                        <span className="text-sm text-purple-400 bg-purple-900/30 border border-purple-500 rounded px-2 py-1">
                          {agent.category}
                        </span>
                        {agent.webhook_url && (
                          <span className="text-sm text-blue-400 bg-blue-900/30 border border-blue-500 rounded px-2 py-1">
                            n8n Ready
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-400 space-y-1 mb-2">
                        <div>Created: {new Date(agent.created_at).toLocaleString()}</div>
                        {agent.updated_at !== agent.created_at && (
                          <div>Updated: {new Date(agent.updated_at).toLocaleString()}</div>
                        )}
                        <div>ID: <span className="text-gray-300 font-mono">{agent.id}</span></div>
                        {agent.input_schema && (
                          <div>Input Fields: <span className="text-green-300">{agent.input_schema.length}</span></div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className={`px-3 py-2 text-xs font-bold rounded border-2 ${
                        agent.is_active 
                          ? 'bg-green-600 text-black border-green-400' 
                          : 'bg-gray-600 text-white border-gray-400'
                      }`}>
                        {agent.is_active ? '✓ ACTIVE' : '✕ INACTIVE'}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xs text-gray-400">COST</div>
                        <div className="text-yellow-400 font-bold text-lg">₹{agent.credit_cost}</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-4 leading-relaxed">{agent.description}</p>

                  {agent.webhook_url && (
                    <div className="mb-4 p-3 bg-black/40 border border-blue-600 rounded text-xs">
                      <div className="text-blue-300">Webhook: <span className="font-mono text-blue-400">{agent.webhook_url}</span></div>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      onClick={() => toggleAgentStatus(agent.id, agent.is_active)}
                      disabled={actionLoading === agent.id}
                      className={`flex-1 px-4 py-3 border-2 transition-all font-bold ${
                        agent.is_active
                          ? 'border-red-500 text-red-400 hover:bg-red-900 hover:text-white'
                          : 'border-green-500 text-green-400 hover:bg-green-900 hover:text-black'
                      } ${actionLoading === agent.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {actionLoading === agent.id ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin mr-2">⟳</div>
                          UPDATING...
                        </span>
                      ) : (
                        agent.is_active ? '⏸ DEACTIVATE' : '▶ ACTIVATE'
                      )}
                    </button>

                    <button
                      onClick={() => deleteAgent(agent.id, agent.name)}
                      disabled={actionLoading === agent.id}
                      className={`px-6 py-3 border-2 border-red-600 text-red-400 hover:bg-red-900 hover:text-white transition-all font-bold ${
                        actionLoading === agent.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {actionLoading === agent.id ? '...' : '🗑 DELETE'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}