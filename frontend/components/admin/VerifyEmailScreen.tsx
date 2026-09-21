"use client";

import { useAuth } from "@/lib/admin/useAuth";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { VerifyEmailForm } from "./VerifyEmailForm";

/**
 * What an account that signed up with a password sees until it types its code back.
 *
 * It stands where the studio would, rather than being a banner inside it, because the API
 * refuses every write from an unconfirmed session — a studio whose buttons all answer 403
 * is worse than being told plainly what is in the way. The way past it is deliberate all
 * the same: somebody who wants to look around first can, and the studio carries the same
 * notice while they do.
 */
export function VerifyEmailScreen({ onSkip }: { onSkip: () => void }) {
  const { session, signOut } = useAuth();
  const email = session?.authorEmail ?? "the address on this account";

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <Panel className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <span aria-hidden className="inline-block size-2.5 rounded-full bg-warm-black" />
          <h1 className="text-sm font-semibold tracking-tight text-warm-black">
            Confirm <span className="font-normal text-warm-slate">/ your address</span>
          </h1>
        </div>

        <p className="mb-5 text-[13px] leading-relaxed text-warm-slate">
          Your account exists and you are signed in. Before you can publish anything from
          it, confirm that <span className="font-medium text-warm-black">{email}</span> is
          yours.
        </p>

        <VerifyEmailForm email={email} />

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-warm-border pt-4">
          <Button variant="ghost" onClick={onSkip}>
            Look around first
          </Button>

          <Button variant="ghost" icon="logout" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Panel>
    </main>
  );
}

/**
 * The same thing as a strip across the top of the studio, for somebody who chose to look
 * around first. Opens the code form in place rather than sending them back to a screen
 * they have already walked away from once.
 */
export function VerifyEmailNotice({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { session } = useAuth();
  const email = session?.authorEmail ?? "the address on this account";

  return (
    <div className="border-b border-warm-border bg-warm-sunken">
      <div className="mx-auto w-full max-w-[1240px] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] leading-relaxed text-warm-slate">
            <span className="font-medium text-warm-black">{email}</span> is not confirmed
            yet, so nothing here can be saved or published.
          </p>

          <Button
            icon={expanded ? "x" : "verified"}
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? "Not now" : "Enter the code"}
          </Button>
        </div>

        {expanded ? (
          <VerifyEmailForm email={email} className="mt-4 max-w-sm" />
        ) : null}
      </div>
    </div>
  );
}
