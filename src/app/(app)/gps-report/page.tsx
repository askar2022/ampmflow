import { redirect } from "next/navigation";

/** School GPS Report lives under Analytics to keep the nav shorter. */
export default function GpsReportPage() {
  redirect("/analytics#gps-report");
}
