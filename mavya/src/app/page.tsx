import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/site/landing";
import { homePath } from "@/lib/auth/roles";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: {
    absolute: "Ovyko · Class management for swim schools, gymnastics, dance and martial arts",
  },
  description:
    "Timetable, families, absences, make-ups and progress for recurring children's classes, with an app parents enjoy opening.",
  // The rest of the app stays out of search results; the website doesn't.
  robots: { index: true, follow: true },
};

// Signed out: the website. Signed in: straight to the shell their role gives them.
export default async function Home() {
  const viewer = await getViewer();
  if (viewer) redirect(homePath(viewer.shells));
  return <Landing />;
}
