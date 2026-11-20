import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RequestHub } from "./RequestHub";

export const dynamic = "force-dynamic";

export default async function WaitingPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; student?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { kind = "", student = "" } = await searchParams;

  // Old ?kind= links → dedicated routes (so loading UI + prefetch work).
  if (kind === "route") redirect("/waiting/route");
  if (kind === "daycare") {
    redirect(student ? `/waiting/daycare?student=${encodeURIComponent(student)}` : "/waiting/daycare");
  }
  if (kind === "address") {
    redirect(student ? `/waiting/address?student=${encodeURIComponent(student)}` : "/waiting/address");
  }

  return <RequestHub />;
}
