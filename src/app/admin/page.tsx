'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

// Import proper interfaces
interface PricingConfig {
  basePrice: number
  customPrices: { [currency: string]: number }
}

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
  pricing_config?: PricingConfig
}

interface FormField {
  id: string
  name: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'email' | 'url'
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [requiresInputs, setRequiresInputs] = useState(false)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  const router = useRouter()
  

  // Form state - FIXED TYPING
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    webhook_url: '',
    is_active: true
  })

  // FIXED: Proper pricing state typing
  const [agentPricing, setAgentPricing] = useState<PricingConfig>({
    basePrice: 50,
    customPrices: {}
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkAdmin()
    loadAgents()
    
    const cleanup = setupRealtimeSubscription()
    return cleanup
  }, [])

  useEffect(() => {
    if (forceUpdate > 0) {
      console.log('UI force updated:', forceUpdate)
    }
  }, [forceUpdate])

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
      
      setForceUpdate(prev => prev + 1)
      
      console.log('Agents loaded:', data?.length || 0)
    } catch (error) {
      console.error('Error loading agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const addFormField = (type: FormField['type']) => {
    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      type,
      label: '',
      placeholder: '',
      required: false,
      options: (type === 'select' || type === 'radio') ? [''] : undefined
    }
    setFormFields([...formFields, newField])
  }

  const updateFormField = (id: string, field: string, value: any) => {
    setFormFields(prevFields => 
      prevFields.map(formField => 
        formField.id === id ? { ...formField, [field]: value } : formField
      )
    )
  }

  const removeFormField = (id: string) => {
    setFormFields(prevFields => prevFields.filter(field => field.id !== id))
  }

  const moveFormField = (id: string, direction: 'up' | 'down') => {
    const currentIndex = formFields.findIndex(field => field.id === id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= formFields.length) return

    const newFields = [...formFields]
    const [movedField] = newFields.splice(currentIndex, 1)
    newFields.splice(newIndex, 0, movedField)
    setFormFields(newFields)
  }

  const addOption = (fieldId: string) => {
    setFormFields(prevFields =>
      prevFields.map(field =>
        field.id === fieldId && field.options
          ? { ...field, options: [...field.options, ''] }
          : field
      )
    )
  }

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    setFormFields(prevFields =>
      prevFields.map(field =>
        field.id === fieldId && field.options
          ? {
              ...field,
              options: field.options.map((option, index) =>
                index === optionIndex ? value : option
              )
            }
          : field
      )
    )
  }

  const removeOption = (fieldId: string, optionIndex: number) => {
    setFormFields(prevFields =>
      prevFields.map(field =>
        field.id === fieldId && field.options && field.options.length > 1
          ? {
              ...field,
              options: field.options.filter((_, index) => index !== optionIndex)
            }
          : field
      )
    )
  }

  const generateInputSchema = () => {
    return formFields
      .filter(field => field.name.trim() && field.label.trim())
      .map(field => ({
        name: field.name,
        type: field.type,
        label: field.label,
        required: field.required,
        placeholder: field.placeholder || undefined,
        options: field.options?.filter(opt => opt.trim()) || undefined
      }))
  }

  const fillSampleData = () => {
    setFormData({
      name: 'SEO Content Analyzer',
      description: 'Analyzes your website content and provides SEO recommendations to improve search engine rankings.',
      category: 'SEO',
      webhook_url: 'https://n8n.irizpro.com/webhook/your-webhook-id',
      is_active: true
    })
    
    setAgentPricing({
      basePrice: 50,
      customPrices: {
        USD: 0.99,
        AED: 3.99
      }
    })

    setRequiresInputs(true)
    setFormFields([
      {
        id: 'field_1',
        name: 'website_url',
        type: 'url',
        label: 'Website URL',
        placeholder: 'https://your-website.com',
        required: true
      },
      {
        id: 'field_2',
        name: 'target_keywords',
        type: 'textarea',
        label: 'Target Keywords',
        placeholder: 'Enter your target keywords, one per line',
        required: true
      }
    ])
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      webhook_url: '',
      is_active: true
    })
    setAgentPricing({
      basePrice: 50,
      customPrices: {}
    })
    setRequiresInputs(false)
    setFormFields([])
    setShowForm(false)
  }

  // FIXED: Proper pricing change handler
  const handlePricingChange = (newPricing: PricingConfig) => {
    setAgentPricing(newPricing)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.description.trim() || !formData.category.trim()) {
      alert('Please fill in all required fields')
      return
    }

    if (!formData.webhook_url.trim()) {
      alert('Webhook URL is required')
      return
    }

    try {
      setSubmitting(true)

      const inputSchema = requiresInputs ? generateInputSchema() : []

      const { data, error } = await supabase
        .from('agents')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category.trim(),
          webhook_url: formData.webhook_url.trim(),
          is_active: formData.is_active,
          input_schema: inputSchema,
          credit_cost: agentPricing.basePrice,
          pricing_config: agentPricing
        })
        .select()

      if (error) throw error

      console.log('Agent created successfully:', data)
      alert('✅ Agent deployed to marketplace successfully!')
      
      resetForm()
      await loadAgents()
      
    } catch (error) {
      console.error('Error creating agent:', error)
      alert(`❌ Failed to deploy agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData({
      name: agent.name,
      description: agent.description,
      category: agent.category,
      webhook_url: agent.webhook_url || '',
      is_active: agent.is_active
    })
    
    setAgentPricing(agent.pricing_config || {
      basePrice: agent.credit_cost,
      customPrices: {}
    })
    
    setRequiresInputs(Boolean(agent.input_schema && agent.input_schema.length > 0))
    setFormFields(agent.input_schema?.map((field: any) => ({
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ...field
    })) || [])
    setShowEditForm(true)
  }

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingAgent) return
    
    try {
      setSubmitting(true)

      const { error } = await supabase
        .from('agents')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category.trim(),
          webhook_url: formData.webhook_url.trim(),
          is_active: formData.is_active,
          pricing_config: agentPricing
        })
        .eq('id', editingAgent.id)

      if (error) throw error

      alert('✅ Agent updated successfully!')
      setShowEditForm(false)
      setEditingAgent(null)
      await loadAgents()
      
    } catch (error) {
      console.error('Error updating agent:', error)
      alert(`❌ Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (agentId: string, currentStatus: boolean) => {
    try {
      setActionLoading(agentId)
      
      const { error } = await supabase
        .from('agents')
        .update({ is_active: !currentStatus })
        .eq('id', agentId)

      if (error) throw error

      await loadAgents()
      
    } catch (error) {
      console.error('Error toggling agent status:', error)
      alert(`Failed to ${!currentStatus ? 'activate' : 'deactivate'} agent`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mb-4"></div>
          <p className="text-white text-lg">Loading Admin Panel...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Admin access required</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-gray-900 to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-yellow-400 mb-2">🔧 ADMIN PANEL</h1>
          <p className="text-gray-300">Manage AI agents in the marketplace</p>
          <p className="text-sm text-gray-400">Logged in as: {user.email}</p>
          
          {/* Add Dashboard Navigation */}
          <div className="mt-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800/50 border border-yellow-500 rounded-lg p-6 text-center">
            <h3 className="text-2xl font-bold text-yellow-400">{agents.length}</h3>
            <p className="text-gray-300">Total Agents</p>
          </div>
          <div className="bg-gray-800/50 border border-green-500 rounded-lg p-6 text-center">
            <h3 className="text-2xl font-bold text-green-400">{agents.filter(a => a.is_active).length}</h3>
            <p className="text-gray-300">Active Agents</p>
          </div>
          <div className="bg-gray-800/50 border border-red-500 rounded-lg p-6 text-center">
            <h3 className="text-2xl font-bold text-red-400">{agents.filter(a => !a.is_active).length}</h3>
            <p className="text-gray-300">Inactive Agents</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span>➕</span>
            <span>{showForm ? 'Hide Form' : 'Deploy New Agent'}</span>
          </button>
          
          {showForm && (
            <button
              onClick={fillSampleData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🧪 Fill Sample Data
            </button>
          )}
        </div>

        {/* Deploy New Agent Form */}
        {showForm && (
          <div className="bg-gray-800/50 border border-green-500 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-green-400 mb-6 text-center">
              ◉ DEPLOY NEW AGENT ◉
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-yellow-400 font-medium mb-2">Agent Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., SEO Content Analyzer"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-yellow-400 font-medium mb-2">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                    required
                  >
                    <option value="">Select Category</option>
                    <option value="SEO">SEO</option>
                    <option value="Content">Content</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Analytics">Analytics</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Business">Business</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* MULTI-CURRENCY PRICING SECTION - INLINE */}
              <MultiCurrencyPricingForm
                initialPricing={agentPricing}
                onPricingChange={handlePricingChange}
              />

              {/* Webhook URL */}
              <div>
                <label className="block text-yellow-400 font-medium mb-2">n8n Webhook URL *</label>
                <input
                  type="url"
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                  placeholder="https://n8n.irizpro.com/webhook/your-webhook-id"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  required
                />
              </div>

              {/* Agent Description */}
              <div>
                <label className="block text-yellow-400 font-medium mb-2">Agent Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe what this agent does, its benefits, and capabilities..."
                  rows={4}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none resize-none"
                  required
                />
              </div>

              {/* User Inputs Toggle */}
              <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresInputs}
                    onChange={(e) => setRequiresInputs(e.target.checked)}
                    className="w-5 h-5 text-yellow-400 bg-gray-900 border-gray-600 rounded focus:ring-yellow-400"
                  />
                  <div>
                    <span className="text-yellow-400 font-medium">🛠 This agent requires user inputs</span>
                    <p className="text-sm text-gray-400">Check this if users need to provide data before executing this agent</p>
                  </div>
                </label>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-5 h-5 text-green-400 bg-gray-900 border-gray-600 rounded focus:ring-green-400"
                />
                <span className="text-green-400 font-medium">✅ Active in Marketplace</span>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-bold text-lg transition-colors"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Deploying...</span>
                    </span>
                  ) : (
                    '🚀 DEPLOY TO MARKETPLACE'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Form Modal */}
        {showEditForm && editingAgent && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border-2 border-blue-500 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="border-b border-blue-500 p-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl text-blue-400 font-bold">Edit Agent: {editingAgent.name}</h3>
                  <button
                    onClick={() => setShowEditForm(false)}
                    className="text-gray-400 hover:text-red-400 text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleUpdateAgent} className="space-y-6">
                  {/* Agent Info Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-yellow-400 font-medium mb-2">Agent Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-yellow-400 font-medium mb-2">Category *</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                        required
                      >
                        <option value="SEO">SEO</option>
                        <option value="Content">Content</option>
                        <option value="Social Media">Social Media</option>
                        <option value="Analytics">Analytics</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Development">Development</option>
                        <option value="Design">Design</option>
                        <option value="Business">Business</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-yellow-400 font-medium mb-2">Description *</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={4}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-yellow-400 font-medium mb-2">Webhook URL *</label>
                    <input
                      type="url"
                      value={formData.webhook_url}
                      onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      className="w-5 h-5 text-green-400 bg-gray-900 border-gray-600 rounded focus:ring-green-400"
                    />
                    <span className="text-green-400 font-medium">✅ Active in Marketplace</span>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-bold text-lg transition-colors"
                    >
                      {submitting ? 'UPDATING...' : 'UPDATE AGENT'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditForm(false)}
                      className="px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Agents List */}
        <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-6">📋 Marketplace Agents ({agents.length})</h2>
          
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-gray-400 text-lg">No agents deployed yet</p>
              <p className="text-gray-500">Deploy your first AI agent to get started!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left py-3 px-4 text-yellow-400">Name</th>
                    <th className="text-left py-3 px-4 text-yellow-400">Category</th>
                    <th className="text-left py-3 px-4 text-yellow-400">Pricing</th>
                    <th className="text-left py-3 px-4 text-yellow-400">Status</th>
                    <th className="text-left py-3 px-4 text-yellow-400">Created</th>
                    <th className="text-left py-3 px-4 text-yellow-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium text-white">{agent.name}</div>
                          <div className="text-sm text-gray-400 max-w-xs truncate">{agent.description}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm">
                          {agent.category}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-white font-medium">
                          ₹{agent.pricing_config?.basePrice || agent.credit_cost}
                        </div>
                        {agent.pricing_config?.customPrices && Object.keys(agent.pricing_config.customPrices).length > 0 && (
                          <div className="text-xs text-gray-400">
                            +{Object.keys(agent.pricing_config.customPrices).length} custom
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded text-sm ${
                          agent.is_active 
                            ? 'bg-green-600 text-white' 
                            : 'bg-red-600 text-white'
                        }`}>
                          {agent.is_active ? '✅ Active' : '❌ Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-400 text-sm">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => startEdit(agent)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          
                          <button
                            onClick={() => handleToggleActive(agent.id, agent.is_active)}
                            disabled={actionLoading === agent.id}
                            className={`px-3 py-1 rounded text-sm transition-colors ${
                              agent.is_active
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            } disabled:opacity-50`}
                          >
                            {actionLoading === agent.id ? '...' : (agent.is_active ? '❌' : '✅')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// INLINE MULTI-CURRENCY PRICING COMPONENT - FIXED TYPES
interface MultiCurrencyPricingFormProps {
  initialPricing: PricingConfig
  onPricingChange: (pricing: PricingConfig) => void
}

function MultiCurrencyPricingForm({ initialPricing, onPricingChange }: MultiCurrencyPricingFormProps) {
  const [enableCustomPricing, setEnableCustomPricing] = useState(
    Object.keys(initialPricing.customPrices).length > 0
  )

  // FIXED: Handle pricing updates properly
  const updatePricing = (basePrice: number, customPrices: { [currency: string]: number }) => {
    const newPricing: PricingConfig = {
      basePrice,
      customPrices: enableCustomPricing ? customPrices : {}
    }
    onPricingChange(newPricing)
  }

  const handleBasePriceChange = (value: number) => {
    updatePricing(value, initialPricing.customPrices)
  }

  // FIXED: Handle custom price changes
  const handleCustomPriceChange = (currency: string, value: string) => {
    const numValue = parseFloat(value) || 0
    const newCustomPrices = { ...initialPricing.customPrices }
    
    if (numValue > 0) {
      newCustomPrices[currency] = numValue
    } else {
      delete newCustomPrices[currency]
    }
    
    updatePricing(initialPricing.basePrice, newCustomPrices)
  }

  const toggleCustomPricing = (enabled: boolean) => {
    setEnableCustomPricing(enabled)
    if (!enabled) {
      updatePricing(initialPricing.basePrice, {})
    }
  }

  return (
    <div className="bg-gray-900/50 border border-blue-500 rounded-lg p-6">
      <h3 className="text-xl font-bold text-blue-400 mb-4">💰 Pricing Configuration</h3>
      
      <div className="space-y-4">
        {/* Base Price */}
        <div>
          <label className="block text-yellow-400 font-medium mb-2">
            Base Price (INR) *
          </label>
          <div className="flex items-center space-x-2">
            <span className="text-gray-300">₹</span>
            <input
              type="number"
              value={initialPricing.basePrice}
              onChange={(e) => handleBasePriceChange(Number(e.target.value))}
              min="1"
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Custom Pricing Toggle */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="customPricing"
              checked={enableCustomPricing}
              onChange={(e) => toggleCustomPricing(e.target.checked)}
              className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="customPricing" className="text-sm font-medium text-blue-300">
              Enable Custom Regional Pricing
            </label>
          </div>
        </div>

        {/* Custom Pricing Inputs */}
        {enableCustomPricing && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* USD */}
            <div>
              <label className="block text-gray-300 font-medium mb-2">
                🇺🇸 USD
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-gray-300">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={initialPricing.customPrices.USD || ''}
                  onChange={(e) => handleCustomPriceChange('USD', e.target.value)}
                  placeholder="Auto-convert"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
            </div>

            {/* AED */}
            <div>
              <label className="block text-gray-300 font-medium mb-2">
                🇦🇪 AED
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-gray-300">د.إ</span>
                <input
                  type="number"
                  step="0.01"
                  value={initialPricing.customPrices.AED || ''}
                  onChange={(e) => handleCustomPriceChange('AED', e.target.value)}
                  placeholder="Auto-convert"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
            </div>

            {/* EUR */}
            <div>
              <label className="block text-gray-300 font-medium mb-2">
                🇪🇺 EUR
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-gray-300">€</span>
                <input
                  type="number"
                  step="0.01"
                  value={initialPricing.customPrices.EUR || ''}
                  onChange={(e) => handleCustomPriceChange('EUR', e.target.value)}
                  placeholder="Auto-convert"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Pricing Preview */}
        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">📊 Pricing Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-yellow-400 font-medium">₹{initialPricing.basePrice}</div>
              <div className="text-gray-500">India (Base)</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-medium">
                ${initialPricing.customPrices.USD || (initialPricing.basePrice * 0.012).toFixed(2)}
              </div>
              <div className="text-gray-500">
                USA {initialPricing.customPrices.USD ? '(Custom)' : '(Auto)'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-medium">
                د.إ{initialPricing.customPrices.AED || (initialPricing.basePrice * 0.044).toFixed(2)}
              </div>
              <div className="text-gray-500">
                UAE {initialPricing.customPrices.AED ? '(Custom)' : '(Auto)'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 font-medium">
                €{initialPricing.customPrices.EUR || (initialPricing.basePrice * 0.011).toFixed(2)}
              </div>
              <div className="text-gray-500">
                Europe {initialPricing.customPrices.EUR ? '(Custom)' : '(Auto)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}