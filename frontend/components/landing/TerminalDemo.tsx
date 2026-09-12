"use client";

import { useState } from "react";

export function TerminalDemo({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<"curl" | "response">("curl");
  const [selectedEndpoint, setSelectedEndpoint] = useState<"create" | "search">("create");
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const snippets = {
    create: {
      curl: `curl -X POST https://api.portfolio.dev/v1/posts \\
  -H "Authorization: Bearer sk_live_9f82d1..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "The Architecture of Clarity",
    "slug": "architecture-of-clarity",
    "published": true
  }'`,
      typescript: `import { PortfolioClient } from "@portfolio/sdk";

const client = new PortfolioClient({
  apiKey: process.env.PORTFOLIO_KEY!,
});

const post = await client.posts.create({
  title: "The Architecture of Clarity",
  slug: "architecture-of-clarity",
  published: true,
});

console.log("Published & Indexed:", post.id);`,
      response: `{
  "id": "post_9f82d1",
  "status": "published",
  "url": "/posts/architecture-of-clarity",
  "author": "jakekato",
  "rag": {
    "status": "indexed",
    "chunks": 12,
    "vectors": 1536,
    "latency_ms": 14
  },
  "created_at": "2026-09-12T01:30:00Z"
}`,
    },
    search: {
      curl: `curl -X POST https://api.portfolio.dev/v1/search/rag \\
  -H "Authorization: Bearer sk_live_9f82d1..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "minimalist software design principles",
    "top_k": 3
  }'`,
      response: `{
  "query": "minimalist software design principles",
  "matches": [
    {
      "post_id": "post_9f82d1",
      "title": "The Architecture of Clarity",
      "similarity": 0.988,
      "snippet": "Great software doesn't feel like software — it disappears into the act of creation."
    }
  ],
  "latency_ms": 11
}`,
    },
  };

  const currentSnippet = snippets[selectedEndpoint];

  const handleCopy = () => {
    const textToCopy = currentSnippet[activeTab];
    navigator.clipboard?.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setActiveTab("response");
    }, 600);
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl border border-slate-700/50 bg-[#090d16] shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl ${className}`}
    >
      {/* ----------------------------------------------------------- */}
      {/* macOS Sequoia Style Terminal Header                         */}
      {/* ----------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-[#0f1422] px-5 py-3.5 gap-3">
        <div className="flex items-center gap-3">
          {/* Traffic Lights */}
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/40 shadow-sm" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/40 shadow-sm" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29]/40 shadow-sm" />
          </div>

          {/* Endpoint quick switcher */}
          <div className="hidden sm:flex items-center gap-1 ml-2 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedEndpoint("create")}
              className={`px-2.5 py-1 rounded-md transition-all ${selectedEndpoint === "create"
                  ? "bg-slate-800 text-cyan-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
                }`}
            >
              POST /posts
            </button>
            <button
              type="button"
              onClick={() => setSelectedEndpoint("search")}
              className={`px-2.5 py-1 rounded-md transition-all ${selectedEndpoint === "search"
                  ? "bg-slate-800 text-indigo-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
                }`}
            >
              POST /search/rag
            </button>
          </div>
        </div>

        {/* Tab Controls & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab("curl")}
              className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === "curl"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
                }`}
            >
              cURL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("response")}
              className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === "response"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
                }`}
            >
              Response
            </button>
          </div>

          {/* Simulate Execution Button */}
          <button
            type="button"
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/60 px-2.5 py-1 text-xs font-mono text-cyan-300 hover:bg-cyan-900/60 hover:text-white transition-colors"
            title="Simulate API Request"
          >
            {isExecuting ? (
              <span className="h-3 w-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            ) : (
              <svg className="h-3.5 w-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <polygon points="5 3 19 10 5 17 5 3" />
              </svg>
            )}
            <span className="hidden md:inline">Run</span>
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-xs font-mono text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
            title="Copy snippet"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* Terminal Code Display Area                                  */}
      {/* ----------------------------------------------------------- */}
      <div className="p-6 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed select-text min-h-[260px] flex flex-col justify-between">
        <pre className="text-slate-200">
          <code>{currentSnippet[activeTab]}</code>
        </pre>
      </div>
    </div>
  );
}
