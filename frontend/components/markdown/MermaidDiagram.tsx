"use client";

import { useEffect, useId, useState } from "react";
import { type Theme, useTheme } from "@/lib/theme";
import { DiagramViewport } from "./DiagramViewport";

type State = { status: "loading" } | { status: "ready"; svg: string } | { status: "error"; message: string };

/** The page's warm palette, per theme. Mermaid bakes colours into the SVG, so it cannot use the CSS tokens. */
const PALETTES: Record<Theme, Record<string, string | boolean>> = {
  light: {
    background: "#fcfbf8",
    primaryColor: "#f3f0ea",
    primaryBorderColor: "#9a8f7a",
    primaryTextColor: "#242321",
    secondaryColor: "#ede9e1",
    tertiaryColor: "#fcfbf8",
    lineColor: "#77736c",
    textColor: "#242321",
    noteBkgColor: "#f7efe0",
    noteBorderColor: "#d4a95f",
    noteTextColor: "#242321",
    actorBkg: "#f3f0ea",
    actorBorder: "#9a8f7a",
    actorTextColor: "#242321",
    actorLineColor: "#dedad2",
    signalColor: "#242321",
    signalTextColor: "#242321",
    labelBoxBkgColor: "#f3f0ea",
    labelBoxBorderColor: "#9a8f7a",
    activationBkgColor: "#ede9e1",
    activationBorderColor: "#9a8f7a",
    sequenceNumberColor: "#fcfbf8",
  },
  dark: {
    darkMode: true,
    background: "#211f1c",
    primaryColor: "#2d2a26",
    primaryBorderColor: "#a89c85",
    primaryTextColor: "#ece7dd",
    secondaryColor: "#34302b",
    tertiaryColor: "#211f1c",
    lineColor: "#a39d92",
    textColor: "#ece7dd",
    noteBkgColor: "#3a3021",
    noteBorderColor: "#d4a95f",
    noteTextColor: "#ece7dd",
    actorBkg: "#2d2a26",
    actorBorder: "#a89c85",
    actorTextColor: "#ece7dd",
    actorLineColor: "#4a453f",
    signalColor: "#ece7dd",
    signalTextColor: "#ece7dd",
    labelBoxBkgColor: "#2d2a26",
    labelBoxBorderColor: "#a89c85",
    activationBkgColor: "#34302b",
    activationBorderColor: "#a89c85",
    sequenceNumberColor: "#211f1c",
  },
};

let loading: Promise<typeof import("mermaid").default> | undefined;

/** Mermaid is large; it loads the first time a page actually has a diagram on it. */
async function loadMermaid(theme: Theme) {
  loading ??= import("mermaid").then(({ default: mermaid }) => mermaid);
  const mermaid = await loading;
  // Set before every render: the theme can change between diagrams, and all diagrams on a
  // page share it, so whichever render runs next wants the current palette.
  mermaid.initialize({
    startOnLoad: false,
    // Diagram source comes from post bodies; strict keeps labels as text, no click handlers.
    securityLevel: "strict",
    theme: "base",
    darkMode: theme === "dark",
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
    themeVariables: PALETTES[theme],
  });
  return mermaid;
}

/** A ```mermaid (or ```sequence) fence, drawn. Falls back to showing the source if it will not parse. */
export function MermaidDiagram({ chart }: { chart: string }) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    loadMermaid(theme)
      .then((mermaid) => mermaid.render(id, chart))
      .then(({ svg }) => {
        if (!cancelled) setState({ status: "ready", svg });
      })
      .catch((error: unknown) => {
        // A failed render leaves its scratch element behind in the body.
        document.getElementById(`d${id}`)?.remove();
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Could not draw this diagram.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, chart, theme]);

  if (state.status === "ready") {
    // Keyed on the drawing, so an edited (or re-themed) diagram starts again from the fitted view.
    return <DiagramViewport key={state.svg} svg={state.svg} />;
  }

  return (
    <figure className="mermaid-diagram" aria-busy={state.status === "loading"}>
      {state.status === "error" ? (
        <figcaption className="mermaid-diagram__error">
          Diagram could not be drawn: {state.message.split("\n")[0]}
        </figcaption>
      ) : null}
      <pre className="mermaid-diagram__source">{chart}</pre>
    </figure>
  );
}
