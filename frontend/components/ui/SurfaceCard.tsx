import { cn } from "@/lib/cn";

type SurfaceCardProps = React.ComponentPropsWithoutRef<"div"> & {
  /** Adds the accent hairline across the top edge, swept in on arrival. */
  accentEdge?: boolean;
};

/** The warm raised panel used for every major block on the page. */
export function SurfaceCard({
  accentEdge = false,
  className,
  children,
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "relative border border-warm-border bg-warm-surface shadow-card",
        accentEdge && "overflow-hidden",
        className,
      )}
      {...props}
    >
      {accentEdge ? (
        <div className="animate-edge-sweep absolute inset-x-0 top-0 h-0.5 bg-warm-accent" />
      ) : null}
      {children}
    </div>
  );
}
