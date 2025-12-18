// Fixed src/components/admin/AgentPricingForm.tsx
// This version fixes all the import errors

import React, { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// Define interfaces locally to avoid import issues
interface CurrencyConfig {
  code: string
  symbol: string
  name: string
  razorpaySupported: boolean
  exchangeRate: number
}

interface PricingConfig {
  basePrice: number
  customPrices?: {
    [currency: string]: number
  }
}

// Define supported currencies locally
const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    razorpaySupported: true,
    exchangeRate: 1 // Base currency
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    razorpaySupported: true,
    exchangeRate: 0.012
  },
  AED: {
    code: 'AED',
    symbol: 'د.إ',
    name: 'UAE Dirham',
    razorpaySupported: true,
    exchangeRate: 0.044
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    razorpaySupported: true,
    exchangeRate: 0.011
  }
}

// Helper functions
function getPrice(pricingConfig: PricingConfig, currency: string): number {
  if (pricingConfig.customPrices && pricingConfig.customPrices[currency]) {
    return pricingConfig.customPrices[currency]
  }
  
  if (currency === 'INR') {
    return pricingConfig.basePrice
  }
  
  const exchangeRate = SUPPORTED_CURRENCIES[currency]?.exchangeRate || 1
  return Math.round(pricingConfig.basePrice * exchangeRate * 100) / 100
}

function formatCurrency(amount: number, currency: string): string {
  const config = SUPPORTED_CURRENCIES[currency]
  if (!config) return `${amount} ${currency}`
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  } catch (error) {
    return `${config.symbol}${amount.toFixed(2)}`
  }
}

interface AgentPricingFormProps {
  initialPricing?: PricingConfig
  onPricingChange: (pricing: PricingConfig) => void
}

export function AgentPricingForm({ initialPricing, onPricingChange }: AgentPricingFormProps) {
  const [basePrice, setBasePrice] = useState(initialPricing?.basePrice || 50)
  const [customPrices, setCustomPrices] = useState(initialPricing?.customPrices || {})
  const [enableCustomPricing, setEnableCustomPricing] = useState(
    initialPricing?.customPrices && Object.keys(initialPricing.customPrices).length > 0
  )

  const updatePricing = (newBasePrice: number, newCustomPrices: Record<string, number>) => {
    const pricingConfig: PricingConfig = {
      basePrice: newBasePrice,
      customPrices: enableCustomPricing ? newCustomPrices : undefined
    }
    onPricingChange(pricingConfig)
  }

  const handleBasePriceChange = (value: number) => {
    setBasePrice(value)
    updatePricing(value, customPrices)
  }

  const handleCustomPriceChange = (currency: string, value: number) => {
    const newCustomPrices = { ...customPrices }
    if (value > 0) {
      newCustomPrices[currency] = value
    } else {
      delete newCustomPrices[currency]
    }
    setCustomPrices(newCustomPrices)
    updatePricing(basePrice, newCustomPrices)
  }

  const toggleCustomPricing = (enabled: boolean) => {
    setEnableCustomPricing(enabled)
    if (enabled) {
      updatePricing(basePrice, customPrices)
    } else {
      updatePricing(basePrice, {})
    }
  }

  return (
    <div className="space-y-6 bg-gray-900 border border-green-500 rounded-lg p-6">
      <h3 className="text-xl text-green-400 font-bold mb-4">
        ◉ AGENT PRICING CONFIGURATION ◉
      </h3>

      {/* Base Price (INR) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-green-300">
          Base Price (INR) *
        </label>
        <div className="flex items-center space-x-3">
          <span className="text-xl">₹</span>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => handleBasePriceChange(Number(e.target.value))}
            className="flex-1 px-3 py-2 bg-black border border-gray-600 rounded text-green-200 focus:border-green-400 focus:outline-none"
            placeholder="50"
            min="1"
          />
          <span className="text-gray-400 text-sm">per credit</span>
        </div>
        <p className="text-xs text-gray-500">
          Base price in Indian Rupees. Other currencies will auto-convert from this unless custom prices are set.
        </p>
      </div>

      {/* Custom Currency Pricing Toggle */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="customPricing"
            checked={enableCustomPricing}
            onChange={(e) => toggleCustomPricing(e.target.checked)}
            className="rounded border-gray-600 text-green-500 focus:ring-green-500"
          />
          <label htmlFor="customPricing" className="text-sm font-medium text-green-300">
            Enable Custom Regional Pricing
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Set specific prices for different markets instead of auto-conversion.
        </p>
      </div>

      {/* Custom Pricing Configuration */}
      {enableCustomPricing && (
        <div className="space-y-4">
          <h4 className="text-lg text-cyan-400 font-medium">Regional Market Pricing</h4>
          
          {Object.entries(SUPPORTED_CURRENCIES).map(([code, config]) => {
            if (code === 'INR') return null // Skip INR as it's the base price
            
            const customPrice = customPrices[code] || 0
            const autoConvertedPrice = (basePrice * (config.exchangeRate || 1)).toFixed(2)
            
            return (
              <div key={code} className="grid grid-cols-3 gap-4 items-center p-3 border border-gray-700 rounded">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{config.symbol}</span>
                  <div>
                    <div className="font-medium text-green-200">{code}</div>
                    <div className="text-xs text-gray-400">{config.name}</div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <input
                    type="number"
                    value={customPrice || ''}
                    onChange={(e) => handleCustomPriceChange(code, Number(e.target.value))}
                    placeholder={`Auto: ${config.symbol}${autoConvertedPrice}`}
                    className="w-full px-2 py-1 bg-black border border-gray-600 rounded text-green-200 text-sm focus:border-green-400 focus:outline-none"
                    step="0.01"
                    min="0"
                  />
                  <div className="text-xs text-gray-500">
                    {customPrice > 0 ? '✦ Custom Price' : `⟲ Auto: ${config.symbol}${autoConvertedPrice}`}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-yellow-400 font-medium">
                    {customPrice > 0 ? formatCurrency(customPrice, code) : `${config.symbol}${autoConvertedPrice}`}
                  </div>
                  <div className="text-xs text-gray-400">
                    per credit
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pricing Preview */}
      <div className="bg-black/50 border border-gray-600 rounded p-4">
        <h4 className="text-lg text-cyan-400 font-medium mb-3">Pricing Preview</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SUPPORTED_CURRENCIES).map(([code, config]) => {
            const price = code === 'INR' ? basePrice : 
                         (enableCustomPricing && customPrices[code]) ? customPrices[code] :
                         basePrice * (config.exchangeRate || 1)
            
            const isCustom = enableCustomPricing && customPrices[code] && code !== 'INR'
            
            return (
              <div key={code} className="flex items-center justify-between p-2 border border-gray-700 rounded">
                <div className="flex items-center space-x-2">
                  <span>{config.symbol}</span>
                  <span className="text-sm">{code}</span>
                </div>
                <div className="text-right">
                  <div className="text-yellow-400 font-medium text-sm">
                    {formatCurrency(price, code)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {code === 'INR' ? 'Base' : isCustom ? 'Custom' : 'Auto'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pricing Strategy Tips */}
      <div className="bg-blue-900/20 border border-blue-500 rounded p-4">
        <h4 className="text-blue-300 font-medium mb-2">💡 Pricing Strategy Tips</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• <strong>USD:</strong> Consider premium pricing ($0.99, $1.99) for US market</li>
          <li>• <strong>AED:</strong> Use attractive round numbers (د.إ 2.99, د.إ 4.99) for UAE</li>
          <li>• <strong>EUR:</strong> Often auto-convert works well, but consider local competitors</li>
          <li>• <strong>Higher value agents:</strong> Use custom pricing for better positioning</li>
          <li>• <strong>Basic agents:</strong> Auto-convert often works for consistent global pricing</li>
        </ul>
      </div>
    </div>
  )
}

// Main Agent Deployment Form
export function AgentDeploymentForm() {
  const [agentData, setAgentData] = useState({
    name: '',
    description: '',
    category: '',
    webhook_url: '',
    pricing: {
      basePrice: 50,
      customPrices: {}
    } as PricingConfig,
  })

  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handlePricingChange = (pricing: PricingConfig) => {
    setAgentData(prev => ({ ...prev, pricing }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Save agent with pricing configuration
      const { error } = await supabase
        .from('agents')
        .insert({
          name: agentData.name,
          description: agentData.description,
          category: agentData.category,
          webhook_url: agentData.webhook_url,
          pricing_config: agentData.pricing, // Store as JSON in database
          status: 'active',
          created_at: new Date().toISOString()
        })
      
      if (error) throw error
      
      alert('Agent deployed successfully!')
      // Reset form
      setAgentData({
        name: '',
        description: '',
        category: '',
        webhook_url: '',
        pricing: { basePrice: 50, customPrices: {} }
      })
    } catch (error) {
      console.error('Failed to deploy agent:', error)
      alert('Failed to deploy agent. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Agent Info */}
      <div className="bg-gray-800 border border-green-500 rounded-lg p-6 space-y-4">
        <h3 className="text-xl text-green-400 font-bold">Agent Information</h3>
        
        <input
          type="text"
          placeholder="Agent Name"
          value={agentData.name}
          onChange={(e) => setAgentData(prev => ({ ...prev, name: e.target.value }))}
          className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-green-200 focus:border-green-400 focus:outline-none"
          required
        />
        
        <textarea
          placeholder="Agent Description"
          value={agentData.description}
          onChange={(e) => setAgentData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-green-200 focus:border-green-400 focus:outline-none h-24"
          required
        />
        
        <select
          value={agentData.category}
          onChange={(e) => setAgentData(prev => ({ ...prev, category: e.target.value }))}
          className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-green-200 focus:border-green-400 focus:outline-none"
          required
        >
          <option value="">Select Category</option>
          <option value="Marketing">Marketing</option>
          <option value="Sales">Sales</option>
          <option value="Research">Research</option>
          <option value="Content">Content</option>
          <option value="Analytics">Analytics</option>
        </select>

        <input
          type="url"
          placeholder="n8n Webhook URL"
          value={agentData.webhook_url}
          onChange={(e) => setAgentData(prev => ({ ...prev, webhook_url: e.target.value }))}
          className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-green-200 focus:border-green-400 focus:outline-none"
          required
        />
      </div>

      {/* Pricing Configuration */}
      <AgentPricingForm
        initialPricing={agentData.pricing}
        onPricingChange={handlePricingChange}
      />

      {/* Deploy Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 text-black font-bold text-lg border-2 border-yellow-400 transition-colors rounded"
      >
        {loading ? 'DEPLOYING AGENT...' : 'DEPLOY AGENT'}
      </button>
    </form>
  )
}