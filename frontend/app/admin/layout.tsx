import type { Metadata } from "next";
import { AdminProviders } from "@/components/admin/AdminProviders";

/** Behind a sign-in and of no use to a crawler, so it is kept out of the index. */
export const metadata: Metadata = {
  title: "Admin Page",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminProviders>{children}</AdminProviders>;
}
