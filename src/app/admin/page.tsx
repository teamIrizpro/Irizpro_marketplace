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
  is_active: boolean
  created_at: string
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    credit_cost: 1,
    category: '',
    is_active: true
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkAdmin()
    loadAgents()
  }, [])

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
      const { error } = await supabase
        .from('agents')
        .insert([formData])

      if (error) throw error

      // Reset form
      setFormData({
        name: '',
        description: '',
        credit_cost: 1,
        category: '',
        is_active: true
      })

      setShowForm(false)
      loadAgents()
      alert('Agent added successfully!')
    } catch (error) {
      console.error('Error adding agent:', error)
      alert('Error adding agent. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleAgentStatus = async (agentId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('agents')
        .update({ is_active: !currentStatus })
        .eq('id', agentId)

      if (error) throw error
      loadAgents()
    } catch (error) {
      console.error('Error updating agent status:', error)
    }
  }

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return

    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId)

      if (error) throw error
      loadAgents()
    } catch (error) {
      console.error('Error deleting agent:', error)
    }
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

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <header className="border-b-2 border-red-500 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-red-400">◉ ADMIN CONTROL PANEL ◉</h1>
            <div className="text-sm">
              Total Agents: {agents.length} | Active: {agents.filter(a => a.is_active).length}
            </div>
          </div>
          
          <nav className="flex items-center space-x-6">
            <button 
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 border border-green-500 text-green-400 hover:bg-green-900 transition-colors"
            >
              {showForm ? 'CANCEL' : 'ADD AGENT'}
            </button>
            
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-cyan-500 text-cyan-400 hover:bg-cyan-900 transition-colors"
            >
              DASHBOARD
            </button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {/* Add Agent Form */}
        {showForm && (
          <div className="mb-8 bg-gray-900 border-2 border-green-500 rounded-lg p-6">
            <h2 className="text-xl text-green-400 mb-6">◉ DEPLOY NEW AGENT ◉</h2>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Agent Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none"
                  placeholder="e.g., Data Processing, Communication, Analytics"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Credit Cost per Execution</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formData.credit_cost}
                  onChange={(e) => setFormData({...formData, credit_cost: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Active in Marketplace</span>
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none h-24"
                  placeholder="Describe what this agent does and its capabilities..."
                  required
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-bold border border-green-400 transition-colors"
                >
                  {submitting ? 'DEPLOYING AGENT...' : 'DEPLOY AGENT'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Agents List */}
        <div className="bg-gray-900 border-2 border-red-500 rounded-lg p-6">
          <h2 className="text-xl text-red-400 mb-6">◉ AGENT REGISTRY ◉</h2>

          {agents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No agents in the system. Deploy your first agent to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`border-2 rounded-lg p-4 ${
                    agent.is_active 
                      ? 'border-green-500 bg-green-900/10' 
                      : 'border-gray-600 bg-gray-800/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-cyan-400">{agent.name}</h3>
                      <div className="text-sm text-gray-400">{agent.category}</div>
                      <div className="text-xs text-gray-500">
                        Created: {new Date(agent.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className={`px-2 py-1 text-xs font-bold rounded ${
                        agent.is_active 
                          ? 'bg-green-600 text-black' 
                          : 'bg-gray-600 text-white'
                      }`}>
                        {agent.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </div>
                      
                      <div className="text-yellow-400 font-bold">
                        ₹{agent.credit_cost}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-4">{agent.description}</p>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => toggleAgentStatus(agent.id, agent.is_active)}
                      className={`px-4 py-2 border transition-colors ${
                        agent.is_active
                          ? 'border-red-500 text-red-400 hover:bg-red-900'
                          : 'border-green-500 text-green-400 hover:bg-green-900'
                      }`}
                    >
                      {agent.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                    </button>

                    <button
                      onClick={() => deleteAgent(agent.id)}
                      className="px-4 py-2 border border-red-600 text-red-400 hover:bg-red-900 transition-colors"
                    >
                      DELETE
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