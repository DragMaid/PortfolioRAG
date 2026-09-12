"use client";

import { useApiTokens } from "@/lib/admin/useApiTokens";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Panel, PanelHeader } from "../ui/Panel";
import { IssueTokenForm } from "./IssueTokenForm";
import { SecretReveal } from "./SecretReveal";
import { TokenRow } from "./TokenRow";

/**
 * The fourth tab: the credentials this account hands to things that are not browsers.
 *
 * Its own tab rather than a panel under the profile, because nothing here is about what
 * the portfolio says — and because the one screen in the studio where a mistake cannot be
 * taken back should not be three panels below a headline editor.
 */
export function AccessPanel() {
  const tokens = useApiTokens();

  if (tokens.state === "loading") return <AccessSkeleton />;

  if (tokens.state === "error") {
    return (
      <Panel className="p-6">
        <EmptyState
          icon="error"
          title="Could not load your API tokens"
          description="The API did not answer. No token has been changed."
          action={<Button onClick={() => void tokens.reload()}>Try again</Button>}
        />
      </Panel>
    );
  }

  const locked = tokens.busy !== null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-warm-border/60 pb-2">
        <div>
          <h1 className="font-serif text-2xl font-medium text-warm-black sm:text-3xl">
            Access & tokens
          </h1>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-warm-slate">
            Long-lived credentials for things that are not this browser — a deploy script, a
            cron job, a dashboard. Each one acts as you, so give out the narrowest that does
            the job and revoke it the moment it stops being needed.
          </p>
        </div>
      </header>

      {/*
       * Keyed on the secret so a rotation remounts the panel rather than swapping the text
       * under a reader who is mid-copy — and so its autofocus fires again.
       */}
      {tokens.revealed ? (
        <SecretReveal
          key={tokens.revealed.secret}
          revealed={tokens.revealed}
          onDismiss={tokens.dismissSecret}
        />
      ) : null}

      <Panel className="flex flex-col gap-4 p-5 sm:p-6">
        <PanelHeader
          icon="hub"
          title="API access tokens"
          description="Send one as “Authorization: Bearer pfl_…”. The list shows every token you have issued, including the dead ones, so a name you recognise is never a surprise."
          aside={
            <span className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 font-mono text-[11px] font-medium text-warm-black">
              {tokens.activeCount} active
            </span>
          }
        />

        {tokens.tokens.length > 0 ? (
          <ul className="divide-y divide-warm-border/60 overflow-hidden rounded border border-warm-border bg-warm-surface">
            {tokens.tokens.map((token) => (
              <li key={token.id}>
                <TokenRow
                  token={token}
                  busy={locked}
                  onRotate={tokens.rotate}
                  onRevoke={tokens.revoke}
                  onForget={tokens.forget}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="hub"
            title="No API tokens"
            description="Nothing but this browser can reach your account. Issue a token below to change that."
          />
        )}

        <IssueTokenForm busy={tokens.busy === "issuing"} onCreate={tokens.create} />
      </Panel>

      <Panel className="flex flex-col gap-3 p-5 sm:p-6">
        <PanelHeader
          icon="verified"
          title="What a token cannot do"
          description="A token is not a second password. These stay in the studio however wide the token's scope, so that losing one is a bounded loss."
        />

        <ul className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-warm-slate">
          <Restriction>
            Issue, rotate or revoke a token — including itself. A token that could mint
            another would outlive its own revocation.
          </Restriction>
          <Restriction>Set or change your password, or link a Google account.</Restriction>
          <Restriction>Change your email address or your handle.</Restriction>
          <Restriction>Close your account.</Restriction>
        </ul>

        <p className="border-t border-warm-border/60 pt-3 font-mono text-[10.5px] leading-relaxed text-warm-slate">
          A read-only token is refused anything but GET. Everything else a signed-in session
          can do, a read + write token can do.
        </p>
      </Panel>
    </section>
  );
}

function Restriction({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-[7px] inline-block size-1 shrink-0 rounded-full bg-warm-slate/60" />
      <span>{children}</span>
    </li>
  );
}

function AccessSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-10 w-1/3 rounded bg-warm-sunken" />
      <div className="h-64 rounded bg-warm-sunken" />
      <div className="h-40 rounded bg-warm-sunken" />
    </div>
  );
}
