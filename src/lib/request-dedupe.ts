export function requestDedupeKey(request: {
  studentId?: string | null;
  title: string;
  payload?: string | null;
}) {
  try {
    const payload = JSON.parse(request.payload || "{}") as {
      kind?: string;
      companyNeed?: string;
      changeTo?: string;
    };
    if (payload.kind === "COMPANY_REPORT" || payload.kind === "PM_COMPANY") {
      return `${request.studentId ?? ""}|COMPANY|${payload.companyNeed || payload.changeTo || "REPORT"}`;
    }
    if (payload.kind === "TODAY_CHANGE") {
      return `${request.studentId ?? ""}|TODAY|${payload.changeTo || request.title}`;
    }
  } catch {
    // Fall through to the title.
  }
  return `${request.studentId ?? ""}|${request.title.trim().toLowerCase()}`;
}

export function uniqueChangeRequests<
  T extends {
    studentId?: string | null;
    title: string;
    payload?: string | null;
  },
>(requests: T[]) {
  const seen = new Set<string>();
  return requests.filter((request) => {
    const key = requestDedupeKey(request);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
