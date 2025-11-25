// src/app/api/razorpay/payment-intent/route.ts
import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';

// Initialize Razorpay with keys from .env.local
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  try {
    const { amount, currency, receipt, notes } = await req.json();

    const order = await razorpay.orders.create({
      amount: amount * 100, // convert to paise
      currency: currency || 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
      notes, // e.g. include { user_id: "..."} so you know who bought the credits
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { error: 'Unable to create order' },
      { status: 500 }
    );
  }
}
