"use client";

import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-mono text-4xl font-bold text-cyan-400 mb-4">
            Dashboard
          </h1>
          <p className="font-mono text-gray-400">
            Welcome to your AI Agent Marketplace dashboard
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6">
            <div className="font-mono text-cyan-400 text-2xl font-bold">0</div>
            <div className="font-mono text-gray-400 text-sm">Credits Remaining</div>
          </div>
          
          <div className="bg-gray-900/50 border border-purple-500/30 rounded-lg p-6">
            <div className="font-mono text-purple-400 text-2xl font-bold">0</div>
            <div className="font-mono text-gray-400 text-sm">Workflows Run</div>
          </div>
          
          <div className="bg-gray-900/50 border border-pink-500/30 rounded-lg p-6">
            <div className="font-mono text-pink-400 text-2xl font-bold">0</div>
            <div className="font-mono text-gray-400 text-sm">Total Spent</div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Link 
            href="/workflows"
            className="block bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg p-6 hover:border-cyan-400/60 transition-all"
          >
            <h3 className="font-mono text-xl font-bold text-white mb-2">
              Browse AI Agents
            </h3>
            <p className="font-mono text-gray-400 text-sm">
              Discover and run AI-powered workflows
            </p>
          </Link>
          
          <Link 
            href="/credits"
            className="block bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6 hover:border-purple-400/60 transition-all"
          >
            <h3 className="font-mono text-xl font-bold text-white mb-2">
              Buy Credits
            </h3>
            <p className="font-mono text-gray-400 text-sm">
              Purchase execution credits starting from ₹1
            </p>
          </Link>
        </div>

        {/* Back link */}
        <div className="mt-12">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>←</span>
            <span>Back to home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}