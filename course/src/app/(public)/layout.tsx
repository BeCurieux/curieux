import { SiteFooter, SiteHeader } from "@/components/site/header";

// The public pages: home, pricing, the free checks, waitlist, legal.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
