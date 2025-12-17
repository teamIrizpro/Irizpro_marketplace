// Fixed src/app/api/razorpay/create-order/route.ts
import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  // Move Razorpay initialization inside the handler to avoid build-time execution
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  try {
    const { packageId, amount, credits } = await req.json();

    if (!packageId || !amount || !credits) {
      return NextResponse.json(
        { error: 'Missing packageId, amount or credits' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email ?? '';

    // 1) Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `cp_${packageId}_${Date.now()}`, // < 40 chars
      notes: {
        user_id: userId,
        user_email: userEmail,
        package_id: packageId,
        credits: String(credits),
      },
    });

    // 2) Store PENDING purchase mapped to this user
    const { error: dbError } = await supabase.from('credit_purchases').insert({
      user_id: userId,
      package_id: packageId,
      razorpay_order_id: order.id,
      amount,
      credits,
      status: 'pending', // you can use enum or text
    });

    if (dbError) {
      console.error('Failed to insert credit_purchases', dbError);
      // still let user pay, but log it
    }

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error('create-order route error:', err);
    return NextResponse.json(
      { error: 'Failed to create Razorpay order' },
      { status: 500 }
    );
  }
}