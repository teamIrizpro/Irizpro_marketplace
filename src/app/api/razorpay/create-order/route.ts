// Fixed src/app/api/razorpay/create-order/route.ts
import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
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

    // Get user session
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

    // Create admin client for bypassing RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Ensure user profile exists (using admin client)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      console.log('Creating new profile for user:', userId);
      
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          full_name: session.user.user_metadata?.full_name || 
                     session.user.user_metadata?.name || 
                     userEmail.split('@')[0],
          credits: 0,
          total_spent: 0,
          total_executions: 0,
          membership_tier: 'free',
          is_active: true
        });

      if (profileError) {
        console.error('Failed to create user profile:', profileError);
        return NextResponse.json(
          { error: 'Failed to create user profile: ' + profileError.message },
          { status: 500 }
        );
      }
      
      console.log('Profile created successfully');
    }

    // Create Razorpay order
    console.log('Creating Razorpay order:', { amount, currency: 'INR' });
    
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `cp_${Date.now().toString().slice(-8)}`,
      notes: {
        user_id: userId,
        user_email: userEmail,
        package_id: packageId,
        credits: String(credits),
      },
    });

    console.log('Razorpay order created:', order.id);

    // Handle package_id - create default package if needed
    let finalPackageId = packageId;
    
    if (packageId.startsWith('agent_')) {
      const { data: defaultPackage } = await supabaseAdmin
        .from('credit_packages')
        .select('id')
        .eq('name', 'Agent Purchase Credits')
        .single();
      
      if (defaultPackage) {
        finalPackageId = defaultPackage.id;
      } else {
        const { data: newPackage, error: packageError } = await supabaseAdmin
          .from('credit_packages')
          .insert({
            name: 'Agent Purchase Credits',
            description: 'Credits for individual agent purchases',
            credits: 1,
            price_inr: Math.round(amount),
            is_active: true
          })
          .select('id')
          .single();
        
        if (!packageError && newPackage) {
          finalPackageId = newPackage.id;
        }
      }
    }

    // Optional: Log the purchase intent (commented out to avoid FK issues)
    try {
      await supabaseAdmin.from('credit_purchases').insert({
        user_id: userId,
        package_id: finalPackageId,
        razorpay_order_id: order.id,
        amount_paid: Math.round(amount * 100),
        credits_purchased: credits,
        total_credits: credits,
        bonus_credits: 0,
        status: 'created',
        currency: 'INR',
        original_amount: amount,
        exchange_rate: 1.0
      });
    } catch (dbError) {
      console.log('DB logging failed (non-critical):', dbError);
    }

    return NextResponse.json({ orderId: order.id });
    
  } catch (err) {
    console.error('create-order route error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create Razorpay order' },
      { status: 500 }
    );
  }
}