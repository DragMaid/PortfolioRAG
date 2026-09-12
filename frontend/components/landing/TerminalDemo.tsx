"use client";

import React, { useState } from "react";

export function TerminalDemo({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<"curl" | "typescript" | "response">("curl");
  const [copied, setCopied] = useState(false);

  const curlCommand = `curl -X POST https://api.portfolio.dev/v1/posts \\
  -H "Authorization: Bearer sk_live_9f82d1..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "The Next Era of Product Systems",
    "category": "Architecture",
    "published": true
  }'`;

  const tsCode = `import { PortfolioClient } from "@portfolio/sdk";

const client = new PortfolioClient({
  apiKey: process.env.PORTFOLIO_KEY!,
});

const post = await client.posts.create({
  title: "The Next Era of Product Systems",
  category: "Architecture",
  published: true,
});

console.log("Published & Indexed:", post.id);`;

  const responseJson = `{
  "id": "post_9f82d1",
  "status": "published",
  "url": "/posts/the-next-era-of-product-systems",
  "author": "jakekato",
  "rag": {
    "status": "indexed",
    "chunks": 14,
    "vectors": 1536,
    "latency_ms": 18
  },
  "created_at": "2026-09-12T01:30:00Z"
}`;

  const handleCopy = () => {
    const textToCopy =
      activeTab === "curl"
        ? curlCommand
        : activeTab === "typescript"
        ? tsCode
        : responseJson;
    navigator.clipboard?.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-[#0b0f19] shadow-2xl backdrop-blur-xl ${className}`}
    >
      {/* ----------------------------------------------------------- */}
      {/* macOS Terminal Titlebar with Traffic Lights & Window Tabs   */}
      {/* ----------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-[#111625] px-4 py-3 gap-2">
        <div className="flex items-center gap-2">
          {/* Traffic Lights */}
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/50" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/50" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29]/50" />
          </div>

          <span className="ml-3 hidden sm:inline text-xs font-mono text-slate-400">
            api.portfolio.sh — zsh — 80x24
          </span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-900/80 p-1 border border-slate-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab("curl")}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === "curl"
                ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            cURL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("typescript")}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === "typescript"
                ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            TypeScript
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("response")}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === "response"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Response (201)
          </button>
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-xs font-mono text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
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

      {/* ----------------------------------------------------------- */}
      {/* Terminal Interior: Code & Syntax Display                    */}
      {/* ----------------------------------------------------------- */}
      <div className="p-5 sm:p-6 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed select-text">
        {activeTab === "curl" && (
          <pre className="text-slate-200">
            <span className="text-slate-500 select-none">$ </span>
            <span className="text-cyan-400 font-semibold">curl</span>
            <span className="text-slate-300"> -X POST </span>
            <span className="text-emerald-400">https://api.portfolio.dev/v1/posts</span>
            <span className="text-slate-400"> \</span>
            {"\n"}
            <span className="text-slate-300">  -H </span>
            <span className="text-amber-300">&quot;Authorization: Bearer sk_live_9f82d1...&quot;</span>
            <span className="text-slate-400"> \</span>
            {"\n"}
            <span className="text-slate-300">  -H </span>
            <span className="text-amber-300">&quot;Content-Type: application/json&quot;</span>
            <span className="text-slate-400"> \</span>
            {"\n"}
            <span className="text-slate-300">  -d </span>
            <span className="text-amber-300">&apos;&#123;</span>
            {"\n"}
            <span className="text-slate-400">    &quot;title&quot;: </span>
            <span className="text-emerald-300">&quot;The Next Era of Product Systems&quot;</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-slate-400">    &quot;category&quot;: </span>
            <span className="text-emerald-300">&quot;Architecture&quot;</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-slate-400">    &quot;published&quot;: </span>
            <span className="text-orange-400">true</span>
            {"\n"}
            <span className="text-amber-300">  &#125;&apos;</span>
            {"\n\n"}
            <span className="text-slate-500 select-none"># Output:</span>
            {"\n"}
            <span className="text-emerald-400 font-semibold">HTTP/2 201 Created</span>
            <span className="text-slate-500"> • </span>
            <span className="text-slate-400">14ms latency • Vector embedding cached</span>
            <span className="animate-cursor text-cyan-400 ml-1">▋</span>
          </pre>
        )}

        {activeTab === "typescript" && (
          <pre className="text-slate-200">
            <span className="text-indigo-400 font-semibold">import</span>
            <span className="text-slate-200"> &#123; PortfolioClient &#125; </span>
            <span className="text-indigo-400 font-semibold">from</span>
            <span className="text-emerald-400"> &quot;@portfolio/sdk&quot;</span>
            <span className="text-slate-400">;</span>
            {"\n\n"}
            <span className="text-indigo-400 font-semibold">const</span>
            <span className="text-cyan-300"> client</span>
            <span className="text-slate-400"> = </span>
            <span className="text-indigo-400 font-semibold">new</span>
            <span className="text-yellow-300"> PortfolioClient</span>
            <span className="text-slate-400">(&#123;</span>
            {"\n"}
            <span className="text-slate-400">  apiKey: </span>
            <span className="text-slate-200">process.env.PORTFOLIO_KEY</span>
            <span className="text-slate-400">!,</span>
            {"\n"}
            <span className="text-slate-400">&#125;);</span>
            {"\n\n"}
            <span className="text-indigo-400 font-semibold">const</span>
            <span className="text-cyan-300"> post</span>
            <span className="text-slate-400"> = </span>
            <span className="text-indigo-400 font-semibold">await</span>
            <span className="text-slate-200"> client.posts.</span>
            <span className="text-yellow-300">create</span>
            <span className="text-slate-400">(&#123;</span>
            {"\n"}
            <span className="text-slate-400">  title: </span>
            <span className="text-emerald-400">&quot;The Next Era of Product Systems&quot;</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-slate-400">  category: </span>
            <span className="text-emerald-400">&quot;Architecture&quot;</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-slate-400">  published: </span>
            <span className="text-orange-400">true</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-slate-400">&#125;);</span>
            <span className="animate-cursor text-cyan-400 ml-1">▋</span>
          </pre>
        )}

        {activeTab === "response" && (
          <pre className="text-slate-200">
            <span className="text-slate-400">&#123;</span>
            {"\n"}
            <span className="text-cyan-300">  &quot;id&quot;</span>
            <span className="text-slate-400">: </span>
            <span className="text-emerald-400">&quot;post_9f82d1&quot;</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-cyan-300">  &quot;status&quot;</span>
            <span className="text-slate-400">: </span>
            <span className="text-emerald-400">&quot;published&quot;</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-cyan-300">  &quot;url&quot;</span>
            <span className="text-slate-400">: </span>
            <span className="text-emerald-400">&quot;/posts/the-next-era-of-product-systems&quot;</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-cyan-300">  &quot;rag&quot;</span>
            <span className="text-slate-400">: &#123;</span>
            {"\n"}
            <span className="text-cyan-300">    &quot;status&quot;</span>
            <span className="text-slate-400">: </span>
            <span className="text-emerald-400">&quot;indexed&quot;</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-cyan-300">    &quot;chunks&quot;</span>
            <span className="text-slate-400">: </span>
            <span className="text-orange-400">14</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-cyan-300">    &quot;vectors&quot;</span>
            <span className="text-slate-400">: </span>
            <span className="text-orange-400">1536</span>
            <span className="text-slate-400">,</span>
            {"\n"}
            <span className="text-cyan-300">    &quot;latency_ms&quot;</span>
            <span className="text-slate-400">: </span>
            <span className="text-orange-400">18</span>
            {"\n"}
            <span className="text-slate-400">  &#125;</span>
            {"\n"}
            <span className="text-slate-400">&#125;</span>
            <span className="animate-cursor text-cyan-400 ml-1">▋</span>
          </pre>
        )}
      </div>

      {/* Terminal Footer Status Bar */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-[#0e1320] px-4 py-2 font-mono text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            201 OK
          </span>
          <span>HTTP/2</span>
          <span>TLS 1.3</span>
        </div>
        <div className="flex items-center gap-3">
          <span>gzip: 420B</span>
          <span>14ms</span>
        </div>
      </div>
    </div>
  );
}
