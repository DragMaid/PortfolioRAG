"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The client id the ID token has to be minted for. The backend verifies the token against
 * its own copy of this, so a mismatch fails the exchange rather than logging anyone in.
 * Absent means Google sign-in is simply not offered — see {@link useGoogleSignIn}.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/* Google Identity Services attaches itself to `window`, and only the two calls used here
   are described — a full typing of the library would be most of a .d.ts for no benefit. */
type GoogleCredentialResponse = { credential?: string };

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        use_fedcm_for_prompt?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "small" | "medium" | "large";
          text?: "signin_with" | "signup_with" | "continue_with";
          shape?: "rectangular" | "pill";
          width?: number;
        },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

type Status = "unconfigured" | "loading" | "ready" | "error";

/** Loads the GIS script once per page, however many buttons ask for it. */
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);

    if (existing) {
      if (window.google) resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Google sign-in failed to load.")));
      }
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // A failed load must not be cached as a success: a blocked request now should not
      // stop the script being tried again on the next mount.
      scriptPromise = null;
      reject(new Error("Google sign-in failed to load."));
    };

    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Renders Google's own sign-in button into `ref` and hands back the ID token it produces.
 *
 * The button has to be Google's rather than one of ours: the credential only arrives
 * through their iframe, and a lookalike button that called `prompt()` would be blocked as a
 * third-party cookie in most browsers.
 *
 * With no client id configured the status is `unconfigured` and nothing is loaded, so a
 * build without Google set up shows password sign-in alone instead of a dead button.
 */
export function useGoogleSignIn(onCredential: (idToken: string) => void | Promise<void>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(
    GOOGLE_CLIENT_ID ? "loading" : "unconfigured",
  );

  /* Kept in a ref so re-rendering the parent does not re-initialize the library, which
     would tear the rendered button out from under the user mid-click. Written in an effect
     rather than during render: a ref is not render state, and assigning one on the way
     through makes the component's output depend on when React chose to call it. */
  const callbackRef = useRef(onCredential);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  const render = useCallback(() => {
    const google = window.google;
    const parent = containerRef.current;
    if (!google || !parent) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response.credential) void callbackRef.current(response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    parent.replaceChildren();

    google.accounts.id.renderButton(parent, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: parent.clientWidth || undefined,
    });

    setStatus("ready");
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    void loadScript()
      .then(() => {
        if (!cancelled) render();
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [render]);

  return { containerRef, status };
}
