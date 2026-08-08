import { redirect } from "next/navigation";

/**
 * /app/this-weekend is in the brief’s page list (§33) and is the URL people
 * will type or bookmark. The dashboard already is this weekend, so rather than
 * maintain two versions of the same page we send it there.
 */
export default function ThisWeekendPage() {
  redirect("/app");
}
