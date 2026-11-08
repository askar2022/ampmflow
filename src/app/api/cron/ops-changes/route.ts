import { NextResponse } from "next/server";
import { isSchoolWeekday } from "@/lib/dates";
import { runScheduledOpsChangeDigests } from "@/lib/ops-change-emails";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isSchoolWeekday()) {
    return NextResponse.json({
      ok: true,
      ran: false,
      reason: "weekend",
      schools: 0,
    });
  }

  const result = await runScheduledOpsChangeDigests();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
