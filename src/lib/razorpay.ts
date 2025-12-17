// Fixed src/lib/razorpay.ts
import Razorpay from "razorpay";

// Create a function to get Razorpay instance instead of top-level initialization
export function getRazorpayInstance() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials are not configured');
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Export for backward compatibility if needed
export const razorpay = {
  getInstance: getRazorpayInstance
};