export type RequestRecordRow = {
  id: string;
  name: string;
  grade: string;
  teacher?: string;
  parent?: string;
  kind?: string;
  detail?: string;
  requestDate?: string;
  request: string;
  company: string;
  waiting: boolean;
};

export function RequestRecordTable({
  rows,
  showTeacher = false,
  showParent = false,
  showKind = false,
  showDate = false,
  empty,
}: {
  rows: RequestRecordRow[];
  showTeacher?: boolean;
  showParent?: boolean;
  showKind?: boolean;
  showDate?: boolean;
  empty: string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-base font-bold text-navy">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th>Grade</th>
              {showTeacher ? <th>Teacher</th> : null}
              {showParent ? <th>Parent</th> : null}
              {showDate ? <th>Request date</th> : null}
              {showKind ? <th>Request type</th> : null}
              <th>Request</th>
              <th className="px-4">Company update</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-line ${
                  row.waiting ? "row-yellow" : "row-green"
                }`}
              >
                <td className="px-4 py-3 font-semibold">{row.name}</td>
                <td>{row.grade.replace(/^grade\s+/i, "") || "—"}</td>
                {showTeacher ? <td>{row.teacher || "—"}</td> : null}
                {showParent ? <td>{row.parent || "—"}</td> : null}
                {showDate ? (
                  <td className="whitespace-nowrap font-semibold text-navy">
                    {row.requestDate || "—"}
                  </td>
                ) : null}
                {showKind ? (
                  <td className="font-extrabold text-navy">
                    {row.kind || row.request}
                  </td>
                ) : null}
                <td className="max-w-[260px] font-normal">
                  {row.detail || row.request}
                </td>
                <td className="px-4 py-3 font-extrabold text-navy">
                  {row.company}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
