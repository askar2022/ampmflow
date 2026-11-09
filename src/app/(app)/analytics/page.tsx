import { redirect } from "next/navigation";

/** Analytics nav removed — GPS Report is the live bus history page. */
export default function AnalyticsPage() {
  redirect("/gps-report");
}