"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-800/60 py-3 text-white"
          : "bg-transparent py-5 text-white"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-12 flex items-center justify-between">
        {/* Brand Logo & Emblem */}
        <Link href="/" className="group flex items-center gap-2.5 focus:outline-none">
          {/* Dual Emblem: Gear meets Petal */}
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              {/* Left gear quadrant */}
              <path
                d="M12 4V2M8 5L6.5 3.5M5 8L3.5 6.5M4 12H2"
                stroke="#94a3b8"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="4" stroke="#94a3b8" strokeWidth="1.5" />
              {/* Right organic petal arch */}
              <path
                d="M12 4C16.4 4 20 7.6 20 12C20 16.4 16.4 20 12 20"
                stroke="#c9b8a0"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <circle cx="15" cy="9" r="1.5" fill="#c9b8a0" />
            </svg>
          </div>

          <div className="flex flex-col">
            <span className="font-sans font-semibold tracking-tight text-sm sm:text-base text-slate-100 group-hover:text-white transition-colors">
              Portfolio<span className="text-slate-500">.</span>dev
            </span>
          </div>
        </Link>

        {/* Right CTA Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/admin"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-slate-100 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-full text-xs font-medium text-[#0b0f19] bg-slate-100 hover:bg-white transition-colors duration-150"
          >
            Launch Studio
          </Link>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex items-center p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
