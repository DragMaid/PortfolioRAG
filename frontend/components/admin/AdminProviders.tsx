"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/admin/useAuth";
import { ToastProvider } from "@/lib/admin/useToast";
import { ToastViewport } from "./ui/ToastViewport";

/**
 * The studio's client boundary. Separate from the layout so the layout can stay a server
 * component and export metadata, which a "use client" module cannot do.
 */
export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        {children}
        <ToastViewport />
      </AuthProvider>
    </ToastProvider>
  );
}
