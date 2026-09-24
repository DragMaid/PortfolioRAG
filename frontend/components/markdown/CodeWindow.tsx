"use client";

import { useRef, useState } from "react";

/** How a fence's language is labelled in the title bar when no filename is given. */
const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Shell",
  sh: "Shell",
  shell: "Shell",
  zsh: "Shell",
  cs: "C#",
  csharp: "C#",
  cpp: "C++",
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  py: "Python",
  python: "Python",
  yml: "YAML",
  yaml: "YAML",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  go: "Go",
  rs: "Rust",
  rust: "Rust",
  md: "Markdown",
  markdown: "Markdown",
  dockerfile: "Dockerfile",
};

/**
 * A fenced code block framed as a macOS window: traffic lights, the filename or language
 * in the title bar, and a copy button. The highlighted code arrives as children.
 */
export function CodeWindow({
  language,
  title,
  children,
}: {
  language?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const label = title ?? (language ? (LANGUAGE_LABELS[language] ?? language) : undefined);

  async function copy() {
    const text = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access denied (insecure origin, permissions); the code is still selectable.
    }
  }

  return (
    <figure className="code-window">
      <figcaption className="code-window__bar">
        <span className="code-window__lights" aria-hidden="true">
          <span className="bg-[#ff5f57]" />
          <span className="bg-[#febc2e]" />
          <span className="bg-[#28c840]" />
        </span>
        <span className="code-window__title">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="code-window__copy"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre ref={preRef}>{children}</pre>
    </figure>
  );
}
