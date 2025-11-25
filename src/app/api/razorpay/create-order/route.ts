import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { supabaseServer } from "@/lib/supabase/server";

const razor = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Get logged-in user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Parse body
    const { credits } = (await req.json()) as { credits: number };

    if (!credits || credits <= 0) {
      return NextResponse.json({ error: "Invalid credits" }, { status: 400 });
    }

    // ₹3 per credit → Razorpay expects paise
    const amountInPaise = credits * 3 * 100;

    // 3. Create Razorpay order
    const order = await razor.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `cred_${user.id}_${Date.now()}`,
      notes: {
        user_id: user.id,
        credits: String(credits),
      },
    });

    // 4. Return order details to frontend
    return NextResponse.json(
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Razorpay create-order error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}
