import { getSession } from "@/lib/auth";
import { defaultBusCompanyEmail } from "@/lib/ops-change-emails";
import { RouteRequestForm } from "./RouteRequestForm";

export default async function WaitingPage() {
  const session = await getSession();
  if (!session) return null;
  const busCompanyEmail = await defaultBusCompanyEmail(session.schoolId);

  return <RouteRequestForm busCompanyEmail={busCompanyEmail} />;
}
