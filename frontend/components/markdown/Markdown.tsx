import type { Element, ElementContent } from "hast";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CodeWindow } from "./CodeWindow";
import { MermaidDiagram } from "./MermaidDiagram";

/** Fences drawn as diagrams rather than shown as code. `sequence` is shorthand for a Mermaid sequence diagram. */
const DIAGRAM_LANGUAGES = new Set(["mermaid", "mmd", "sequence"]);

/**
 * Markdown as a reader gets it: GFM, fenced code in a highlighted window, and Mermaid
 * fences drawn as diagrams. The studio's preview renders through this too, so what the
 * author sees is what gets published.
 *
 * Works from a server component — the diagram and the copy button hydrate on their own.
 */
export function Markdown({
  children,
  components,
}: {
  children: string;
  components?: Components;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        // No guessing: an unlabelled fence stays plain text rather than being coloured as
        // whichever language the detector happens to prefer.
        [rehypeHighlight, { detect: false, plainText: [...DIAGRAM_LANGUAGES] }],
      ]}
      components={{
        pre: ({ node }) => {
          const code = node?.children.find(
            (child): child is Element => child.type === "element" && child.tagName === "code",
          );
          if (!code) return null;

          const language = languageOf(code);
          const source = textOf(code).replace(/\n$/, "");

          if (language && DIAGRAM_LANGUAGES.has(language)) {
            return (
              <MermaidDiagram
                chart={
                  language === "sequence" && !/^\s*sequenceDiagram\b/.test(source)
                    ? `sequenceDiagram\n${source}`
                    : source
                }
              />
            );
          }

          return (
            <CodeWindow language={language} title={titleOf(code)}>
              <code className={classNames(code).join(" ")}>{renderChildren(code.children)}</code>
            </CodeWindow>
          );
        },
        ...components,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function classNames(element: Element): string[] {
  const value = element.properties.className;
  return Array.isArray(value) ? value.map(String) : [];
}

function languageOf(code: Element): string | undefined {
  const match = classNames(code).find((name) => name.startsWith("language-"));
  return match?.slice("language-".length).toLowerCase();
}

/** A filename after the language — ```ts title="api.ts"``` or just ```ts api.ts```. */
function titleOf(code: Element): string | undefined {
  const meta = (code.data as { meta?: string } | undefined)?.meta?.trim();
  if (!meta) return undefined;
  const quoted = /title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta);
  if (quoted) return quoted[1] ?? quoted[2] ?? quoted[3];
  return meta.split(/\s+/)[0];
}

function textOf(node: ElementContent | Element): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/**
 * The highlighter's output is a handful of nested spans; turning them back into React by
 * hand keeps the `pre` override in charge of the wrapper without a second hast-to-JSX pass.
 */
function renderChildren(children: ElementContent[]): React.ReactNode {
  return children.map((child, index) => {
    if (child.type === "text") return child.value;
    if (child.type !== "element") return null;
    return (
      <span key={index} className={classNames(child).join(" ") || undefined}>
        {renderChildren(child.children)}
      </span>
    );
  });
}
