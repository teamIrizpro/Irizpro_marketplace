"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface ModernHeaderProps {
  user?: any;
  credits?: number;
}

export default function ModernHeader({ user, credits }: ModernHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = user
    ? [
        { href: "/browse", label: "Browse Agents" },
        { href: "/dashboard", label: "My Dashboard" },
        ...(user.email === "team@irizpro.com"
          ? [{ href: "/admin", label: "Agent Console" }]
          : []),
      ]
    : [
        { href: "/browse", label: "Browse Agents" },
      ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-950/90 backdrop-blur-md border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">AgentHub</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {/* Credits display */}
                {credits !== undefined && (
                  <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                    <span className="text-sm font-medium text-white">
                      {credits} credits
                    </span>
                  </div>
                )}

                {/* User menu */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {user.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <form action="/auth/logout" method="post">
                    <button
                      type="submit"
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Logout
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-6 py-2.5 text-gray-300 hover:text-white transition-colors font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 font-medium hover:scale-105"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
