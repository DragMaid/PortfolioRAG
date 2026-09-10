"use client";

import { SignInForm } from "@/components/admin/SignInForm";
import { Studio } from "@/components/admin/Studio";
import { useAuth } from "@/lib/admin/useAuth";

export default function AdminPage() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="font-mono text-xs text-warm-slate">Loading studio…</p>
      </main>
    );
  }

  return status === "authenticated" ? <Studio /> : <SignInForm />;
}
