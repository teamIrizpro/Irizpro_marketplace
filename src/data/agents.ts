// Simplified src/data/agents.ts - Remove complex imports for now
// This fixes the build errors while you test the admin form

export interface Agent {
  id: string
  name: string
  description: string
  category: string
  credit_cost: number
  webhook_url?: string
  status: 'active' | 'inactive'
}

// Simple static agents data for now - admin form will add to database
export const allAgents: Agent[] = [
  {
    id: 'seo-content-agent',
    name: 'SEO Content Strategy Agent',
    description: 'Advanced SEO keyword research and content planning',
    category: 'Marketing',
    credit_cost: 50, // Simple INR pricing for now
    webhook_url: 'https://your-n8n-instance.com/webhook/seo-agent',
    status: 'active'
  },
  
  {
    id: 'social-media-agent',
    name: 'Social Media Content Generator',
    description: 'Create engaging social media content across platforms',
    category: 'Marketing',
    credit_cost: 30,
    webhook_url: 'https://your-n8n-instance.com/webhook/social-agent',
    status: 'active'
  },

  {
    id: 'lead-generation-agent',
    name: 'B2B Lead Generation Agent',
    description: 'Automated lead research and outreach sequences',
    category: 'Sales',
    credit_cost: 200,
    webhook_url: 'https://your-n8n-instance.com/webhook/lead-agent',
    status: 'active'
  }
]

// Simple helper functions without complex imports
export function getAgentsWithPricing(currency: string = 'INR') {
  return allAgents.map(agent => ({
    ...agent,
    resolvedPrice: agent.credit_cost, // Simple pricing for now
    isPriceHardcoded: false
  }))
}

export function getAgentWithPricing(agentId: string, currency: string = 'INR') {
  const agent = allAgents.find(a => a.id === agentId)
  if (!agent) return null
  
  return {
    ...agent,
    resolvedPrice: agent.credit_cost,
    isPriceHardcoded: false
  }
}