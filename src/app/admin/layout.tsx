import type { Metadata } from "next";
import { requireStaff } from "@/lib/actions/admin/guard";

export const metadata: Metadata = {
  title: { default: "Back office", template: "%s · Back office" },
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return children;
}
