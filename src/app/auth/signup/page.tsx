"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr'

// Mock auth function - replace when Supabase client is fixed
async function createAccount(email: string, password: string, fullName: string) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });
  return { 
    success: !error, 
    error: error?.message, 
    needsVerification: !data.session 
  };
}

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "verification">("form");
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const result = await createAccount(formData.email, formData.password, formData.fullName);
      
      if (result.success) {
        if (result.needsVerification) {
          setStep("verification");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "verification") {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        {/* Animated background */}
        <div className="absolute inset-0 opacity-15">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.1)_1px,transparent_1px)] bg-[size:80px_80px] animate-pulse"></div>
        </div>

        <div className="relative z-10 w-full max-w-md px-6">
          <div className="bg-gray-900/90 border border-green-500/40 rounded-xl backdrop-blur-sm overflow-hidden">
            
            {/* Success header */}
            <div className="border-b border-green-500/30 bg-green-500/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500/20 border border-green-400 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-green-400">✓</span>
                </div>
                <div>
                  <div className="font-mono text-green-400 font-bold">Account created!</div>
                  <div className="font-mono text-xs text-gray-400">verification required</div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="font-mono text-white text-lg">Check your email</div>
                <div className="font-mono text-sm text-gray-400">
                  We&apos;ve sent a verification link to:
                </div>
                <div className="font-mono text-cyan-400 bg-black/30 rounded px-3 py-2 border border-cyan-500/20">
                  {formData.email}
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3">
                <div className="font-mono text-yellow-400 text-xs space-y-1">
                  <div className="font-bold">⚡ Development Notice:</div>
                  <div>Email verification might not work in local development.</div>
                  <div>Contact support if you don&apos;t receive the email.</div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setStep("form")}
                  className="w-full py-2 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 font-mono text-sm rounded transition-colors"
                >
                  ← Change email address
                </button>
                
                <Link
                  href="/auth/login"
                  className="block w-full py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white text-center font-mono text-sm rounded transition-all"
                >
                  Continue to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-15">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(147,51,234,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(147,51,234,0.1)_1px,transparent_1px)] bg-[size:80px_80px] animate-pulse"></div>
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400 rounded-full opacity-60 animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: '3s'
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          
          {/* Back to home link */}
          <div className="mb-8">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 font-mono text-purple-400 hover:text-purple-300 transition-colors group"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              <span>back to terminal</span>
            </Link>
          </div>

          {/* Signup terminal window */}
          <div className="bg-gray-900/90 border border-purple-500/40 rounded-xl backdrop-blur-sm overflow-hidden shadow-[0_0_40px_rgba(147,51,234,0.2)]">
            
            {/* Terminal header */}
            <div className="border-b border-purple-500/30 bg-black/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse delay-100"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse delay-200"></div>
                  </div>
                  <div className="font-mono text-purple-400 text-sm">
                    account-creation-terminal
                  </div>
                </div>
                <div className="font-mono text-xs text-gray-500">
                  secure-registration
                </div>
              </div>
            </div>

            {/* Terminal content */}
            <div className="p-6 space-y-6">
              
              {/* Terminal prompt */}
              <div className="space-y-1">
                <div className="font-mono text-green-400 text-sm">
                  $ initializing account creation...
                </div>
                <div className="font-mono text-gray-400 text-xs">
                  join the ai agent marketplace • get instant access
                </div>
              </div>

              {/* Signup form */}
              <form onSubmit={handleSignup} className="space-y-4">
                
                {/* Full Name input */}
                <div className="space-y-2">
                  <label className="font-mono text-purple-400 text-sm flex items-center gap-2">
                    <span className="text-green-400">&gt;</span>
                    <span>full_name:</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full bg-black/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-500 focus:border-purple-400/60 focus:outline-none focus:shadow-[0_0_20px_rgba(147,51,234,0.2)] transition-all"
                    placeholder="John Doe"
                    required
                  />
                </div>

                {/* Email input */}
                <div className="space-y-2">
                  <label className="font-mono text-purple-400 text-sm flex items-center gap-2">
                    <span className="text-green-400">&gt;</span>
                    <span>email_address:</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-black/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-500 focus:border-purple-400/60 focus:outline-none focus:shadow-[0_0_20px_rgba(147,51,234,0.2)] transition-all"
                    placeholder="user@example.com"
                    required
                  />
                </div>

                {/* Password input */}
                <div className="space-y-2">
                  <label className="font-mono text-purple-400 text-sm flex items-center gap-2">
                    <span className="text-green-400">&gt;</span>
                    <span>password:</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full bg-black/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-500 focus:border-purple-400/60 focus:outline-none focus:shadow-[0_0_20px_rgba(147,51,234,0.2)] transition-all"
                    placeholder="••••••••••••"
                    minLength={6}
                    required
                  />
                </div>

                {/* Confirm Password input */}
                <div className="space-y-2">
                  <label className="font-mono text-purple-400 text-sm flex items-center gap-2">
                    <span className="text-green-400">&gt;</span>
                    <span>confirm_password:</span>
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full bg-black/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-500 focus:border-purple-400/60 focus:outline-none focus:shadow-[0_0_20px_rgba(147,51,234,0.2)] transition-all"
                    placeholder="••••••••••••"
                    minLength={6}
                    required
                  />
                </div>

                {/* Error message */}
                {error && (
                  <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/40 text-red-400 font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">⚠</span>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-mono font-bold transition-all bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>creating account...</span>
                    </div>
                  ) : (
                    <span>execute ./create_account</span>
                  )}
                </button>
              </form>

              {/* Terms notice */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                <div className="font-mono text-xs text-purple-300">
                  By creating an account, you agree to our terms of service and privacy policy.
                </div>
              </div>

              {/* Additional options */}
              <div className="pt-4 border-t border-gray-700/50 space-y-3">
                
                {/* Mode switch prompt */}
                <div className="text-center">
                  <span className="font-mono text-gray-400 text-sm">
                    already have an account?
                  </span>
                  <Link
                    href="/auth/login"
                    className="ml-2 font-mono text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    ./login
                  </Link>
                </div>

                {/* System status */}
                <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                  <span>connection: secure</span>
                  <span>encryption: AES-256</span>
                  <span>status: ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits preview */}
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-mono text-lg font-bold text-purple-400">50+</div>
              <div className="font-mono text-xs text-gray-500">AI Agents</div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-cyan-400">₹1</div>
              <div className="font-mono text-xs text-gray-500">Min Cost</div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-pink-400">24/7</div>
              <div className="font-mono text-xs text-gray-500">Available</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}