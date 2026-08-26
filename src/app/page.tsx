import { redirect } from "next/navigation";
import { getSession, homePath } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(homePath(session.role));
}
