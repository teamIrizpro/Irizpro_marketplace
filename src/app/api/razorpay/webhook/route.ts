import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers.get("x-razorpay-signature");

    if (!webhookSecret || !signature) {
      return NextResponse.json(
        { error: "Missing webhook secret or signature" },
        { status: 400 },
      );
    }

    // 1. Read raw body for signature verification
    const rawBody = await req.text();

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("Razorpay webhook signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // 2. Parse event
    const payload = JSON.parse(rawBody) as any;

    if (payload.event !== "payment.captured") {
      // Ignore all other events for now
      return NextResponse.json({ received: true });
    }

    const payment = payload.payload.payment.entity;

    const userId = payment.notes?.user_id as string | undefined;
    const creditsStr = payment.notes?.credits as string | undefined;
    const credits = creditsStr ? Number(creditsStr) : 0;

    if (!userId || !credits) {
      console.error("Webhook missing user_id / credits in notes");
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // 3. Fetch user's current credits
    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("credits")
      .eq("id", userId)
      .single();

    if (userError || !userRow) {
      console.error("User not found while processing webhook", userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newCredits = (userRow.credits ?? 0) + credits;

    // 4. Update credits
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ credits: newCredits })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update credits", updateError);
      return NextResponse.json(
        { error: "Failed to update user credits" },
        { status: 500 },
      );
    }

    // 5. Optional: log transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      credits,
      amount: payment.amount / 100, // Rs
      razorpay_payment_id: payment.id,
      status: payment.status,
      raw: payload, // if you created a 'raw' jsonb column
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Razorpay webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler error" },
      { status: 500 },
    );
  }
}
