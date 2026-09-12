import React from "react";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="w-full bg-[#07090f] text-slate-400 border-t border-slate-800/80 py-16 px-6 sm:px-12 font-sans">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-12 border-b border-slate-800">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 border border-slate-700">
                <span className="text-cyan-400 font-mono text-xs font-bold">P</span>
              </div>
              <span className="font-sans font-bold text-white tracking-tight">
                Portfolio<span className="text-cyan-400">.</span>dev
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Where technical complexity dissolves into creative expression. Automated
              OpenAPI generation, edge distribution, and vector intelligence for modern builders.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>All Systems Operational (99.99% SLA)</span>
            </div>
          </div>

          {/* Nav Column 1 */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#roadmap" className="hover:text-cyan-400 transition-colors">
                  Cartography
                </a>
              </li>
              <li>
                <a href="#developer" className="hover:text-cyan-400 transition-colors">
                  API &amp; OpenAPI
                </a>
              </li>
              <li>
                <Link href="/admin" className="hover:text-cyan-400 transition-colors">
                  Markdown Studio
                </Link>
              </li>
              <li>
                <a href="#developer" className="hover:text-cyan-400 transition-colors">
                  RAG Embeddings
                </a>
              </li>
            </ul>
          </div>

          {/* Nav Column 2 */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
              Architecture
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-slate-500">TypeScript SDK</span>
              </li>
              <li>
                <span className="text-slate-500">Edge Caching</span>
              </li>
              <li>
                <span className="text-slate-500">Vector Search</span>
              </li>
              <li>
                <span className="text-slate-500">Zero Maintenance</span>
              </li>
            </ul>
          </div>

          {/* Nav Column 3 */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
              Start Creating
            </h4>
            <p className="text-xs text-slate-400">
              Ready to break free from infrastructure busywork?
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-md transition-transform hover:scale-[1.02]"
            >
              <span>Open Studio</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Bottom Credits & Legal */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Portfolio Platform. Crafted for developers &amp; creators.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 transition-colors">Privacy Policy</span>
            <span className="hover:text-slate-400 transition-colors">Terms of Service</span>
            <span className="hover:text-slate-400 transition-colors">Security</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
