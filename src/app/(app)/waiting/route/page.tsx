import { getSession } from "@/lib/auth";
import { RouteRequestForm } from "../RouteRequestForm";

export const dynamic = "force-dynamic";

/** Paint the form immediately — bus company email loads in the client. */
export default async function WaitingRoutePage() {
  const session = await getSession();
  if (!session) return null;
  return <RouteRequestForm />;
}
