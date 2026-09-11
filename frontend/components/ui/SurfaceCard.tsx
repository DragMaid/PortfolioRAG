import { cn } from "@/lib/cn";

type SurfaceCardProps = React.ComponentPropsWithoutRef<"div"> & {
  /** Adds the gradient hairline across the top edge. */
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
        "relative rounded-2xl border border-warm-border bg-warm-surface shadow-card",
        accentEdge && "overflow-hidden",
        className,
      )}
      {...props}
    >
      {accentEdge ? (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-warm-accent/40 via-warm-border to-transparent" />
      ) : null}
      {children}
    </div>
  );
}
