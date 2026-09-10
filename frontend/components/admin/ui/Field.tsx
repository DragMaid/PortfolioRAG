import type { InputHTMLAttributes, ReactNode } from "react";
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
        className="font-mono text-[11px] tracking-wider text-warm-slate uppercase"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="font-mono text-[10.5px] text-warm-slate">{hint}</p> : null}
    </div>
  );
}

/** The sunken input the prototype uses: it lifts to the surface colour on focus. */
export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "rounded border border-warm-border bg-warm-sunken px-3 py-2 text-warm-black",
        "transition-colors placeholder:text-warm-slate/70",
        "focus:border-warm-black focus:bg-warm-surface focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
