"use client";

import { useState } from "react";
import { SignInForm } from "@/components/admin/SignInForm";
import { Studio } from "@/components/admin/Studio";
import { VerifyEmailScreen } from "@/components/admin/VerifyEmailScreen";
import { useAuth } from "@/lib/admin/useAuth";

export default function AdminPage() {
  const { status, session } = useAuth();

  /*
   * Whether somebody with an unconfirmed address has asked to look at the studio anyway.
   * Held here rather than in storage on purpose — it lasts as long as the tab, and a
   * reload puts the code screen back in front of them.
   */
  const [skippedVerification, setSkippedVerification] = useState(false);

  if (status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="font-mono text-xs text-warm-slate">Loading studio…</p>
      </main>
    );
  }

  if (status !== "authenticated") return <SignInForm />;

  /*
   * A session exists but nothing has vouched for the address behind it — a sign-up with a
   * password, before the code. The API refuses every write from one, so the code screen
   * comes first; Google accounts never land here, because the provider confirmed the
   * address when it handed it over.
   */
  if (session && !session.emailConfirmed && !skippedVerification) {
    return <VerifyEmailScreen onSkip={() => setSkippedVerification(true)} />;
  }

  return <Studio />;
}
