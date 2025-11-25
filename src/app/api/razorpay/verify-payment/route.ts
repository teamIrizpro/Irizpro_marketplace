import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get transaction details
    const { data: transaction, error: txnError } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("user_id", user.id)
      .single();

    if (txnError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Update transaction status
    await supabase
      .from("credit_transactions")
      .update({
        status: "completed",
        razorpay_payment_id,
        razorpay_signature,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    // Add credits to user account
    const { data: currentUser } = await supabase
      .from("users")
      .select("credits")
      .eq("id", user.id)
      .single();

    const currentCredits = currentUser?.credits || 0;
    const newCredits = currentCredits + transaction.credits;

    await supabase
      .from("users")
      .update({ credits: newCredits })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      credits: newCredits,
      message: `Successfully added ${transaction.credits} credits!`,
    });

  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}