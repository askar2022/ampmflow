import Link from "next/link";
import { getSession } from "@/lib/auth";
import { defaultBusCompanyEmail } from "@/lib/ops-change-emails";
import { RouteRequestForm } from "./RouteRequestForm";

export default async function WaitingPage() {
  const session = await getSession();
  if (!session) return null;
  const busCompanyEmail = await defaultBusCompanyEmail(session.schoolId);

  return (
    <div className="space-y-6">
      <RouteRequestForm busCompanyEmail={busCompanyEmail} />
      <p className="text-sm text-muted">
        After you submit, open{" "}
        <Link href="/changes" className="font-semibold text-navy underline">
          Open requests
        </Link>{" "}
        to see this student with every other unfinished request until Minnehaha
        assigns a bus.
      </p>
    </div>
  );
}
