"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Mock login for now
    setTimeout(() => {
      if (email && password.length >= 6) {
        router.push("/dashboard");
      } else {
        setError("Invalid credentials");
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        
        {/* Back to home */}
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>←</span>
            <span>back to home</span>
          </Link>
        </div>

        {/* Login form */}
        <div className="bg-gray-900/90 border border-cyan-500/40 rounded-xl p-6">
          
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="font-mono text-2xl font-bold text-white mb-2">Login</h1>
            <p className="font-mono text-sm text-gray-400">Enter your credentials</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Email */}
            <div>
              <label className="block font-mono text-cyan-400 text-sm mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-500 focus:border-cyan-400/60 focus:outline-none"
                placeholder="user@example.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block font-mono text-cyan-400 text-sm mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-500 focus:border-cyan-400/60 focus:outline-none"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 font-mono text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-mono font-bold rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center">
            <Link 
              href="/auth/signup"
              className="font-mono text-sm text-cyan-400 hover:text-cyan-300"
            >
              Need an account? Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}