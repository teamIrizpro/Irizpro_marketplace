"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const [terminalText, setTerminalText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  const messages = [
    "$ initializing n8n marketplace...",
    "$ loading automation workflows...",
    "$ connecting to agent network...",
    "$ system ready. welcome to the future.",
  ];

  useEffect(() => {
    let messageIndex = 0;
    let charIndex = 0;

    const typeText = () => {
      if (messageIndex < messages.length) {
        if (charIndex < messages[messageIndex].length) {
          setTerminalText(prev => prev + messages[messageIndex][charIndex]);
          charIndex++;
          setTimeout(typeText, 50);
        } else {
          setTerminalText(prev => prev + "\n");
          messageIndex++;
          charIndex = 0;
          setTimeout(typeText, 800);
        }
      }
    };

    const timer = setTimeout(typeText, 1000);

    // Cursor blink
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => {
      clearTimeout(timer);
      clearInterval(cursorTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse"></div>
      </div>
      
      {/* Scanning line effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 animate-[scan_3s_ease-in-out_infinite]"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Terminal header with auth buttons */}
        <div className="border-b border-cyan-500/30 bg-black/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse delay-150"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse delay-300"></div>
                </div>
                <div className="font-mono text-cyan-400 text-sm">
                  n8n-marketplace-terminal v2.7.4
                </div>
              </div>
              
              {/* Auth buttons in top right */}
              <div className="flex items-center gap-3">
                <Link 
                  href="/auth/login"
                  className="font-mono text-sm px-4 py-2 text-cyan-400 hover:text-cyan-300 transition-colors border border-cyan-500/30 rounded hover:border-cyan-400/60 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                >
                  ./login
                </Link>
                <Link 
                  href="/auth/signup"
                  className="font-mono text-sm px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded hover:from-cyan-600 hover:to-purple-600 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                >
                  ./signup
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Hero section */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left column - Terminal */}
            <div className="space-y-8">
              <div className="bg-gray-900/80 border border-cyan-500/30 rounded-lg p-6 backdrop-blur-sm">
                <div className="font-mono text-green-400 text-sm whitespace-pre-line min-h-[120px]">
                  {terminalText}
                  {showCursor && <span className="text-cyan-400">█</span>}
                </div>
              </div>
              
              <div className="space-y-4">
                <h1 className="font-mono text-4xl lg:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
                  AI Agent
                  <br />
                  <span className="text-white">Marketplace</span>
                </h1>
                
                <p className="text-gray-300 text-lg font-mono leading-relaxed max-w-md">
                  Deploy ready-made automation workflows. 
                  <span className="text-cyan-400"> Execute with credits.</span>
                  <span className="text-purple-400"> Scale instantly.</span>
                </p>
              </div>
            </div>

            {/* Right column - Action cards */}
            <div className="space-y-6">
              <div className="grid gap-4">
                
                {/* Browse Workflows Card */}
                <Link href="/workflows" className="group block">
                  <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg p-6 backdrop-blur-sm transition-all duration-300 group-hover:border-cyan-400/60 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-mono text-xl font-bold text-white">./browse_agents</h3>
                      <div className="text-cyan-400 group-hover:translate-x-1 transition-transform">→</div>
                    </div>
                    <p className="text-gray-400 text-sm font-mono">
                      Discover AI workflows for SEO, research, automation & more
                    </p>
                  </div>
                </Link>

                {/* Login Card */}
                <Link href="/auth/login" className="group block">
                  <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6 backdrop-blur-sm transition-all duration-300 group-hover:border-purple-400/60 group-hover:shadow-[0_0_30px_rgba(147,51,234,0.3)]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-mono text-xl font-bold text-white">./login</h3>
                      <div className="text-purple-400 group-hover:translate-x-1 transition-transform">→</div>
                    </div>
                    <p className="text-gray-400 text-sm font-mono">
                      Access your dashboard & start running workflows
                    </p>
                  </div>
                </Link>

                {/* Credits Card */}
                <Link href="/credits" className="group block">
                  <div className="bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-500/30 rounded-lg p-6 backdrop-blur-sm transition-all duration-300 group-hover:border-pink-400/60 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.3)]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-mono text-xl font-bold text-white">./buy_credits</h3>
                      <div className="text-pink-400 group-hover:translate-x-1 transition-transform">→</div>
                    </div>
                    <p className="text-gray-400 text-sm font-mono">
                      Purchase execution credits • Starting from ₹1
                    </p>
                  </div>
                </Link>
              </div>

              {/* Stats display */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="font-mono text-2xl font-bold text-cyan-400">50+</div>
                  <div className="font-mono text-xs text-gray-500 uppercase tracking-wider">Workflows</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-2xl font-bold text-purple-400">₹1</div>
                  <div className="font-mono text-xs text-gray-500 uppercase tracking-wider">Min Credit</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-2xl font-bold text-pink-400">24/7</div>
                  <div className="font-mono text-xs text-gray-500 uppercase tracking-wider">Available</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="border-t border-cyan-500/30 bg-black/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="font-mono text-sm text-gray-400">
                <span className="text-cyan-400">STATUS:</span> SYSTEM OPERATIONAL
              </div>
              <div className="flex items-center gap-6 text-sm font-mono">
                <div className="text-gray-400">
                  <span className="text-purple-400">NETWORK:</span> n8n-mainnet
                </div>
                <div className="text-gray-400">
                  <span className="text-pink-400">LATENCY:</span> 12ms
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
        
        body {
          font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
        }
      `}</style>
    </div>
  );
}