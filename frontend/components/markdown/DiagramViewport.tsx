"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type View = { x: number; y: number; scale: number };

const FITTED: View = { x: 0, y: 0, scale: 1 };
const MIN_SCALE = 0.25;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;
const PAN_STEP = 80;

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/**
 * A drawn diagram that can be moved around and zoomed, the way GitHub shows Mermaid: drag to
 * pan, Ctrl/⌘ + scroll or pinch to zoom about the pointer, and a control pad for the rest.
 *
 * A plain scroll wheel is left alone, so reading past a diagram never gets caught in it.
 */
export function DiagramViewport({ svg }: { svg: string }) {
  const figureRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const [view, setView] = useState<View>(FITTED);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Only ever rendered in the browser (the diagram is drawn client-side), so this is safe here.
  const [canFullscreen] = useState(() => document.fullscreenEnabled);

  /** Zoom by `factor`, keeping the point at client (cx, cy) still — the centre if omitted. */
  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;

    const rect = viewport.getBoundingClientRect();
    // The canvas's untransformed origin, in viewport coordinates.
    const px = (cx ?? rect.left + rect.width / 2) - rect.left - canvas.offsetLeft;
    const py = (cy ?? rect.top + rect.height / 2) - rect.top - canvas.offsetTop;

    setView((current) => {
      const scale = clampScale(current.scale * factor);
      const ratio = scale / current.scale;
      return { scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  }, []);

  const pan = (dx: number, dy: number) =>
    setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));

  // React's onWheel is passive; stopping the page from zooming needs a real listener.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onWheel(event: WheelEvent) {
      // Trackpad pinches arrive as wheel events with ctrlKey set.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      // A pinch sends many small deltas, a mouse wheel one large one; capping keeps a single
      // notch to about the same step as the zoom button.
      const delta = Math.max(-25, Math.min(25, event.deltaY));
      zoomAt(Math.exp(-delta * 0.01), event.clientX, event.clientY);
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === figureRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const active = pointers.current;
    const previous = active.get(event.pointerId);
    if (!previous) return;

    const next = { x: event.clientX, y: event.clientY };

    if (active.size === 2) {
      // Pinch: zoom by the change in finger spread, about the midpoint between them.
      const [other] = [...active].filter(([id]) => id !== event.pointerId).map(([, p]) => p);
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) zoomAt(after / before, (next.x + other.x) / 2, (next.y + other.y) / 2);
    } else if (active.size === 1) {
      pan(next.x - previous.x, next.y - previous.y);
    }

    active.set(event.pointerId, next);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const actions: Record<string, () => void> = {
      "+": () => zoomAt(ZOOM_STEP),
      "=": () => zoomAt(ZOOM_STEP),
      "-": () => zoomAt(1 / ZOOM_STEP),
      "0": () => setView(FITTED),
      ArrowUp: () => pan(0, PAN_STEP),
      ArrowDown: () => pan(0, -PAN_STEP),
      ArrowLeft: () => pan(PAN_STEP, 0),
      ArrowRight: () => pan(-PAN_STEP, 0),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void figureRef.current?.requestFullscreen();
  }

  const moved = view.x !== 0 || view.y !== 0 || view.scale !== 1;

  return (
    <figure ref={figureRef} className="mermaid-diagram mermaid-diagram--interactive">
      <div
        ref={viewportRef}
        role="img"
        tabIndex={0}
        aria-roledescription="diagram"
        aria-label="Diagram. Drag to move, Control or Command plus scroll to zoom; arrow keys, plus, minus and zero also work."
        className="mermaid-diagram__viewport"
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setView(FITTED)}
      >
        <div
          ref={canvasRef}
          className="mermaid-diagram__canvas"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          // Mermaid's own output, sanitised by it under securityLevel "strict".
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <div className="mermaid-diagram__controls">
        <div className="mermaid-diagram__pad">
          <span />
          <ControlButton label="Pan up" onClick={() => pan(0, PAN_STEP)}>
            <path d="M6 15l6-6 6 6" />
          </ControlButton>
          <span />
          <ControlButton label="Pan left" onClick={() => pan(PAN_STEP, 0)}>
            <path d="M15 6l-6 6 6 6" />
          </ControlButton>
          <ControlButton label="Reset view" onClick={() => setView(FITTED)} disabled={!moved}>
            <path d="M4 12a8 8 0 1 0 2.34-5.66M4 4v4h4" />
          </ControlButton>
          <ControlButton label="Pan right" onClick={() => pan(-PAN_STEP, 0)}>
            <path d="M9 6l6 6-6 6" />
          </ControlButton>
          <span />
          <ControlButton label="Pan down" onClick={() => pan(0, -PAN_STEP)}>
            <path d="M6 9l6 6 6-6" />
          </ControlButton>
          <span />
        </div>

        <div className="mermaid-diagram__zoom">
          <ControlButton
            label="Zoom in"
            onClick={() => zoomAt(ZOOM_STEP)}
            disabled={view.scale >= MAX_SCALE}
          >
            <path d="M12 5v14M5 12h14" />
          </ControlButton>
          <ControlButton
            label="Zoom out"
            onClick={() => zoomAt(1 / ZOOM_STEP)}
            disabled={view.scale <= MIN_SCALE}
          >
            <path d="M5 12h14" />
          </ControlButton>
          {canFullscreen ? (
            <ControlButton
              label={fullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              )}
            </ControlButton>
          ) : null}
        </div>
      </div>

      <span className="mermaid-diagram__zoom-level" aria-live="polite">
        {moved ? `${Math.round(view.scale * 100)}%` : ""}
      </span>
    </figure>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="mermaid-diagram__button"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}
