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
          ? "bg-[#0b0f19]/85 backdrop-blur-md border-b border-slate-800/80 shadow-md py-3 text-white"
          : "bg-transparent py-5 text-white"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-12 flex items-center justify-between">
        {/* Brand Logo & Emblem */}
        <Link href="/" className="group flex items-center gap-2.5 focus:outline-none">
          {/* Dual Emblem: Gear meets Petal */}
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-700/80 shadow-inner">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              {/* Left gear quadrant */}
              <path
                d="M12 4V2M8 5L6.5 3.5M5 8L3.5 6.5M4 12H2"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="4" stroke="#38bdf8" strokeWidth="1.5" />
              {/* Right organic petal arch */}
              <path
                d="M12 4C16.4 4 20 7.6 20 12C20 16.4 16.4 20 12 20"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="15" cy="9" r="1.5" fill="#fb923c" />
            </svg>
          </div>

          <div className="flex flex-col">
            <span className="font-sans font-bold tracking-tight text-sm sm:text-base text-white group-hover:text-cyan-400 transition-colors">
              Portfolio<span className="text-cyan-400">.</span>dev
            </span>
          </div>
        </Link>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-8 text-xs sm:text-sm font-medium text-slate-300">
          <a
            href="#roadmap"
            className="hover:text-white transition-colors hover:underline underline-offset-4"
          >
            Roadmap
          </a>
          <a
            href="#developer"
            className="hover:text-white transition-colors hover:underline underline-offset-4"
          >
            API &amp; Terminal
          </a>
          <Link
            href="/admin"
            className="hover:text-white transition-colors hover:underline underline-offset-4"
          >
            Studio
          </Link>
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/admin"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md transition-all duration-150 hover:scale-[1.02]"
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

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0e1320] border-b border-slate-800 px-6 py-4 space-y-3 font-mono text-xs">
          <a
            href="#roadmap"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 hover:text-cyan-400"
          >
            // Roadmap &amp; Cartography
          </a>
          <a
            href="#developer"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 hover:text-cyan-400"
          >
            // Developer Terminal
          </a>
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 hover:text-cyan-400"
          >
            // Content Studio
          </Link>
          <div className="pt-2 border-t border-slate-800 flex gap-2">
            <Link
              href="/admin"
              className="w-full text-center py-2.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600"
            >
              Start Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
