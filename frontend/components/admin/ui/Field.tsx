import type { ComponentPropsWithRef, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A labelled control. The label is always rendered — none of these are self-evident. */
export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-warm-black"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-[13px] leading-snug text-warm-slate">{hint}</p> : null}
    </div>
  );
}

/** The sunken input the prototype uses: it lifts to the surface colour on focus. */
export function TextInput({
  className,
  ...props
  // NOTE: with-ref, so a caller can put the cursor back in the box — the code form does
  // it after a wrong code. React 19 passes a ref straight through as a prop.
}: ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "min-w-0 rounded border border-warm-border bg-warm-sunken px-3 py-2 text-warm-black",
        "transition-colors placeholder:text-warm-slate/70",
        "focus:border-warm-black focus:bg-warm-surface focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/** The same control for copy that runs to more than one line. */
export function TextArea({
  className,
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "min-w-0 resize-y rounded border border-warm-border bg-warm-sunken px-3 py-2 text-warm-black",
        "transition-colors placeholder:text-warm-slate/70",
        "focus:border-warm-black focus:bg-warm-surface focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
