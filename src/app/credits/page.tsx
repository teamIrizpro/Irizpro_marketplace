'use client';

import { useState } from 'react';

export default function BuyCredits() {
  const [credits, setCredits] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRazorpay() {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  const handleBuyCredits = async () => {
    setError(null);
    setLoading(true);

    // fetch order from our API
    const res = await fetch('/api/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify({ credits }),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to create order');
      setLoading(false);
      return;
    }

    const orderId = data.orderId;
    const scriptLoaded = await loadRazorpay();
    if (!scriptLoaded) {
      setError('Razorpay SDK failed to load.');
      setLoading(false);
      return;
    }

    const options: any = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: credits * 3 * 100, // amount in paise
      currency: 'INR',
      name: 'n8n Marketplace',
      description: `${credits} Credits`,
      order_id: orderId,
      handler: (response: any) => {
        // On success, Razorpay will call the webhook.
        // You can also call an API to verify the signature here if desired.
        alert('Payment successful! Credits will be updated shortly.');
      },
      prefill: {
        name: '', // you can fill user name / email if available
        email: '',
      },
      theme: {
        color: '#0096FF',
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
    setLoading(false);
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Buy Credits</h1>
      <label className="block mb-2">
        Credits to purchase:
        <input
          type="number"
          value={credits}
          min={1}
          onChange={(e) => setCredits(parseInt(e.target.value))}
          className="ml-2 p-2 border rounded w-20"
        />
      </label>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <button
        onClick={handleBuyCredits}
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Buy'}
      </button>
    </main>
  );
}
