// Enhanced src/lib/currency.ts with hardcoded pricing support
// Supports both automatic conversion AND custom pricing per currency

export interface CurrencyConfig {
  code: string
  symbol: string
  name: string
  razorpaySupported: boolean
  exchangeRate: number // Rate to USD base - used for automatic conversion
}

export interface PricingConfig {
  basePrice: number // Price in base currency (INR)
  customPrices?: {
    [currency: string]: number // Custom hardcoded prices
  }
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    razorpaySupported: true,
    exchangeRate: 0.012 // 1 INR = 0.012 USD (approximate)
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    razorpaySupported: true,
    exchangeRate: 1 // Base currency for conversion
  },
  AED: {
    code: 'AED',
    symbol: 'د.إ',
    name: 'UAE Dirham',
    razorpaySupported: true,
    exchangeRate: 0.27 // 1 AED = 0.27 USD (approximate)
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    razorpaySupported: true,
    exchangeRate: 1.05 // 1 EUR = 1.05 USD (approximate)
  }
}

// Country to currency mapping
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  'IN': 'INR', // India
  'US': 'USD', // United States
  'AE': 'AED', // United Arab Emirates
  'DE': 'EUR', // Germany
  'FR': 'EUR', // France
  'IT': 'EUR', // Italy
  'ES': 'EUR', // Spain
  'GB': 'USD', // UK (fallback to USD as GBP might not be supported)
  'CA': 'USD', // Canada (fallback)
  'AU': 'USD', // Australia (fallback)
  'SG': 'USD', // Singapore (fallback)
}

// ENHANCED: Get price with custom hardcoded pricing support
export function getPrice(pricingConfig: PricingConfig, currency: string): number {
  // Priority 1: Check for hardcoded custom price
  if (pricingConfig.customPrices && pricingConfig.customPrices[currency]) {
    console.log(`Using hardcoded price for ${currency}: ${pricingConfig.customPrices[currency]}`)
    return pricingConfig.customPrices[currency]
  }
  
  // Priority 2: Auto-convert from base price (INR)
  if (currency === 'INR') {
    return pricingConfig.basePrice
  }
  
  // Convert from INR to target currency
  const convertedPrice = convertCurrency(pricingConfig.basePrice, 'INR', currency)
  console.log(`Auto-converted price from ₹${pricingConfig.basePrice} INR to ${currency}: ${convertedPrice}`)
  return convertedPrice
}

// Check if a price is hardcoded (custom) or auto-converted
export function isPriceHardcoded(pricingConfig: PricingConfig, currency: string): boolean {
  return !!(pricingConfig.customPrices && pricingConfig.customPrices[currency])
}

// Get price with indicators
export function getPriceWithType(pricingConfig: PricingConfig, currency: string): {
  price: number
  isHardcoded: boolean
  source: 'hardcoded' | 'converted'
} {
  const isHardcoded = isPriceHardcoded(pricingConfig, currency)
  const price = getPrice(pricingConfig, currency)
  
  return {
    price,
    isHardcoded,
    source: isHardcoded ? 'hardcoded' : 'converted'
  }
}

export function detectUserCurrency(): string {
  // Try to detect user's country/currency
  try {
    // Method 1: Browser timezone detection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (timezone.includes('Kolkata') || timezone.includes('Delhi') || timezone.includes('Mumbai') || timezone.includes('Calcutta')) return 'INR'
    if (timezone.includes('Dubai') || timezone.includes('Abu_Dhabi') || timezone.includes('Riyadh')) return 'AED'
    if (timezone.includes('Europe/') || timezone.includes('Paris') || timezone.includes('Berlin') || timezone.includes('Rome') || timezone.includes('Madrid')) return 'EUR'
    if (timezone.includes('America/') || timezone.includes('New_York') || timezone.includes('Los_Angeles') || timezone.includes('Chicago')) return 'USD'

    // Method 2: Browser locale detection
    const locale = navigator.language || navigator.languages?.[0] || 'en-US'
    if (locale.includes('en-IN') || locale.includes('hi') || locale.includes('mr') || locale.includes('ta')) return 'INR'
    if (locale.includes('ar-AE') || locale.includes('ar-SA')) return 'AED'
    if (locale.includes('de') || locale.includes('fr') || locale.includes('it') || locale.includes('es') || locale.includes('en-GB')) return 'EUR'

  } catch (error) {
    console.log('Currency detection failed, using USD as fallback')
  }

  // Default fallback to USD for rest of world
  return 'USD'
}

export function convertCurrency(
  amount: number, 
  fromCurrency: string, 
  toCurrency: string
): number {
  const fromRate = SUPPORTED_CURRENCIES[fromCurrency]?.exchangeRate || 1
  const toRate = SUPPORTED_CURRENCIES[toCurrency]?.exchangeRate || 1
  
  // Convert to USD first, then to target currency
  const usdAmount = amount * fromRate
  const convertedAmount = usdAmount / toRate
  
  return Math.round(convertedAmount * 100) / 100 // Round to 2 decimal places
}

export function formatCurrency(amount: number, currency: string): string {
  const config = SUPPORTED_CURRENCIES[currency]
  if (!config) return `${amount} ${currency}`
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  } catch (error) {
    // Fallback formatting
    return `${config.symbol}${amount.toFixed(2)}`
  }
}

export function getCurrencyConfig(currency: string): CurrencyConfig | null {
  return SUPPORTED_CURRENCIES[currency] || null
}

// EXAMPLE: How to define agent pricing with custom prices
export const EXAMPLE_AGENT_PRICING: PricingConfig = {
  basePrice: 50, // ₹50 INR base price
  customPrices: {
    // Custom hardcoded prices (optional)
    'USD': 0.99, // $0.99 USD (premium pricing for US market)
    'AED': 3.99, // د.إ 3.99 AED (rounded to attractive price)
    // 'EUR': Will auto-convert from INR since not specified
  }
}

// Real-time currency conversion (you might want to use a currency API)
export async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    // In production, use a real currency API like:
    // - https://api.exchangerate-api.com/v4/latest/USD
    // - https://fixer.io/
    // - https://currencylayer.com/
    
    // For now, return static rates (you should update these regularly)
    return {
      INR: 83.5,  // 1 USD = 83.5 INR
      AED: 3.67,  // 1 USD = 3.67 AED
      EUR: 0.95,  // 1 USD = 0.95 EUR
      USD: 1      // Base currency
    }
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error)
    return {
      INR: 83.5,
      AED: 3.67,
      EUR: 0.95,
      USD: 1
    }
  }
}

// Get user's preferred currency (stored in localStorage or detected)
export function getUserPreferredCurrency(): string {
  try {
    const stored = localStorage.getItem('preferred_currency')
    if (stored && SUPPORTED_CURRENCIES[stored]) {
      return stored
    }
  } catch (error) {
    console.log('localStorage not available')
  }
  
  return detectUserCurrency()
}

// Set user's preferred currency
export function setUserPreferredCurrency(currency: string): void {
  try {
    if (SUPPORTED_CURRENCIES[currency]) {
      localStorage.setItem('preferred_currency', currency)
    }
  } catch (error) {
    console.log('Failed to save currency preference')
  }
}