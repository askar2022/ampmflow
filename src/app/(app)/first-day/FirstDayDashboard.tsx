"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { emailLeadershipAction } from "@/app/actions/gate";
import { LiveRefresh } from "@/components/LiveRefresh";
import {
  AM_LABEL,
  PM_LABEL,
  type GateCounts,
  type GateStudent,
  type ImportSummary,
} from "@/lib/gate";

type Focus =
  | "notCheckedIn"
  | "notConfirmed"
  | "absences"
  | "absentNoBus"
  | "arrivingLate"
  | "transferred"
  | "unableToReach"
  | "busTomorrow"
  | null;

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function width(part: number, whole: number) {
  if (!whole || !part) return 0;
  return Math.max(4, Math.round((part / whole) * 100));
}

function IconPeople() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.5.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM2 19.2C2 16.3 6.1 15 9 15s7 1.3 7 4.2V21H2v-1.8zm13  .3c0-1.3.5-2.3 1.3-3.1 1.3-.4 2.6-.6 3.7-.6 2.4 0 6 .9 6 3.4V21h-11v-1.5z"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.3 16.6 4.9 12.2l1.4-1.4 3 3 8.4-8.4 1.4 1.4z"
      />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 3 3 10h2v10h6v-6h2v6h6V10h2L12 3z" />
    </svg>
  );
}

function IconBus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3v11H4V5zm2 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 8h12v5H6V8z"
      />
    </svg>
  );
}

export function FirstDayDashboard({
  schoolName,
  counts,
  lastUpdated,
  dateLabel,
  clock,
  importSummary,
  students,
  wakandaCount,
}: {
  schoolName: string;
  counts: GateCounts;
  lastUpdated: string;
  dateLabel: string;
  clock: string;
  importSummary: ImportSummary | null;
  students: GateStudent[];
  wakandaCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [emailTo, setEmailTo] = useState("");
  const [message, setMessage] = useState("");
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);

  const active = counts.totalStudents;
  const attendance = pct(counts.checkedIn, active);
  const returning = counts.returning;
  const incoming = counts.newApplication;
  const other = Math.max(0, active - returning - incoming);
  const wakanda = Math.min(Math.max(0, wakandaCount), active);

  const summary = useMemo(() => {
    const check =
      counts.checkedIn === 0
        ? `0 of ${active} active students have checked in`
        : `${counts.checkedIn} of ${active} active students have checked in`;
    const dismiss =
      counts.notConfirmed.students === 0
        ? "Dismissal is confirmed for every active student"
        : `Dismissal remains unconfirmed for ${counts.notConfirmed.students} students from ${counts.notConfirmed.families} families`;
    const bus =
      counts.pickupTodayBusTomorrow.students === 0
        ? "No families currently require a bus beginning tomorrow"
        : `${counts.pickupTodayBusTomorrow.students} students from ${counts.pickupTodayBusTomorrow.families} families need a bus beginning tomorrow`;
    return `${check}. ${dismiss}. ${bus}.`;
  }, [active, counts]);

  const attention = [
    {
      id: "notCheckedIn" as const,
      label: "Not Checked In",
      value: counts.notCheckedIn,
      urgent: true,
    },
    {
      id: "notConfirmed" as const,
      label: "PM Not Confirmed",
      value: counts.notConfirmed.students,
      urgent: true,
    },
    {
      id: "absences" as const,
      label: "Confirmed Absences",
      value: counts.confirmedAbsences,
      urgent: true,
    },
    {
      id: "absentNoBus" as const,
      label: "Absent—No Bus",
      value: counts.absentNoBus,
      urgent: true,
    },
    {
      id: "arrivingLate" as const,
      label: "Arriving Late",
      value: counts.arrivingLate,
      urgent: false,
    },
    {
      id: "transferred" as const,
      label: "Transferred School",
      value: counts.transferred,
      urgent: false,
    },
    {
      id: "unableToReach" as const,
      label: "Unable to Reach",
      value: counts.unableToReach,
      urgent: true,
    },
  ];
  const hot = attention.filter((item) => item.value > 0);
  const shown = showAllAttention ? attention : hot;
  const canToggleZeros = hot.length < attention.length;

  const focused = useMemo(() => {
    if (!focus) return [];
    return students.filter((student) => {
      if (focus === "notCheckedIn") return student.amArrival === "NOT_CHECKED_IN";
      if (focus === "notConfirmed") return student.pmDismissal === "NOT_CONFIRMED";
      if (focus === "absences") return student.amArrival === "ABSENT_CONFIRMED";
      if (focus === "absentNoBus") return student.amFollowUp === "ABSENT_NO_BUS";
      if (focus === "arrivingLate") return student.amFollowUp === "ARRIVING_LATE";
      if (focus === "transferred") return student.amFollowUp === "TRANSFERRED";
      if (focus === "unableToReach") return student.amFollowUp === "UNABLE_TO_REACH";
      return student.pmDismissal === "PARENT_PICKUP_TODAY_BUS_TOMORROW";
    });
  }, [focus, students]);

  const importDate = importSummary?.at
    ? new Date(importSummary.at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="lead-dash">
      <header className="lead-head">
        <div>
          <h1>
            {schoolName.includes("Sankofa")
              ? "Sankofa Prep — First-Day Operations Dashboard"
              : `${schoolName} — First-Day Operations Dashboard`}
          </h1>
          <p className="lead-sub">
            <span>{dateLabel}</span>
            <span className="lead-live" aria-live="polite">
              Live
            </span>
            <span>Last updated {clock}</span>
            <span className="lead-quiet">{lastUpdated}</span>
          </p>
        </div>
        <div className="lead-actions no-print">
          <span className="sr-only">
            <LiveRefresh seconds={20} compact />
          </span>
          <button type="button" className="lead-btn" onClick={() => router.refresh()}>
            Refresh
          </button>
          <button type="button" className="lead-btn" onClick={() => window.print()}>
            Print / PDF
          </button>
          <label className="lead-email-wrap">
            <span className="sr-only">Optional extra email</span>
            <input
              className="lead-email"
              type="email"
              placeholder="Optional extra email"
              value={emailTo}
              onChange={(event) => setEmailTo(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="lead-btn lead-btn-on"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await emailLeadershipAction(emailTo);
                setMessage(
                  result.ok
                    ? `Emailed leadership: ${result.to.join(", ")}.`
                    : result.error || "Email failed.",
                );
              });
            }}
          >
            Email Leadership
          </button>
        </div>
      </header>
      {message ? <p className="lead-flash">{message}</p> : null}

      <section className="lead-kpis">
        <article className="lead-kpi accent-navy">
          <div className="lead-kpi-icon icon-navy">
            <IconPeople />
          </div>
          <p>Active Students</p>
          <strong>{active}</strong>
          <span>
            {returning} returning · {incoming} new applications
          </span>
        </article>
        <article className="lead-kpi accent-teal">
          <div className="lead-kpi-icon icon-teal">
            <IconCheck />
          </div>
          <p>Checked In Today</p>
          <strong>
            {counts.checkedIn}
            <small> / {active}</small>
          </strong>
          <span className="lead-pct">{attendance}% attendance</span>
        </article>
        <article className="lead-kpi accent-blue">
          <div className="lead-kpi-icon icon-blue">
            <IconHome />
          </div>
          <p>Active Families</p>
          <strong>{counts.totalFamilies}</strong>
          <span>Unique families on the active list</span>
        </article>
        <article className="lead-kpi accent-orange">
          <div className="lead-kpi-icon icon-orange">
            <IconBus />
          </div>
          <p>Transportation Attention</p>
          <strong>{counts.pickupTodayBusTomorrow.students}</strong>
          <span>
            {counts.pickupTodayBusTomorrow.students} students ·{" "}
            {counts.pickupTodayBusTomorrow.families} families
          </span>
          <span>Parent Pickup Today Only—Bus Needed Tomorrow</span>
        </article>
      </section>

      <p className="lead-sentence">{summary}</p>

      <section className="lead-card">
        <h2>Enrollment Composition</h2>
        <div className="lead-stack" aria-hidden={active === 0}>
          <i className="seg-return" style={{ width: `${width(returning, active)}%` }} />
          <i className="seg-new" style={{ width: `${width(incoming, active)}%` }} />
          {other ? (
            <i className="seg-other" style={{ width: `${width(other, active)}%` }} />
          ) : null}
        </div>
        <div className="lead-legend">
          <span>
            <i className="lead-dot seg-return" />
            Returning students {returning} · {pct(returning, active)}%
          </span>
          <span>
            <i className="lead-dot seg-new" />
            New applications {incoming} · {pct(incoming, active)}%
          </span>
          {other ? (
            <span>
              <i className="lead-dot seg-other" />
              Other {other} · {pct(other, active)}%
            </span>
          ) : null}
          {wakanda ? (
            <span>
              <i className="lead-dot seg-wakanda" />
              Wakanda students attending Sankofa {wakanda} · {pct(wakanda, active)}%
            </span>
          ) : null}
        </div>
      </section>

      <section className="lead-split">
        <article className="lead-card">
          <h2>AM Arrival</h2>
          <ArrivalRow
            label="Parent Drop-Off"
            value={counts.parentDropOff}
            total={active}
            tone="teal"
          />
          <ArrivalRow
            label="Bus Drop-Off"
            value={counts.busDropOff}
            total={active}
            tone="blue"
          />
          <ArrivalRow
            label="Not Checked In"
            value={counts.notCheckedIn}
            total={active}
            tone="amber"
          />
          <ArrivalRow
            label="Absent—Confirmed"
            value={counts.confirmedAbsences}
            total={active}
            tone="red"
          />
        </article>
        <article className="lead-card">
          <h2>PM Dismissal</h2>
          <ArrivalRow
            label="Parent Pickup—Confirmed"
            value={counts.parentPickupConfirmed.students}
            extra={`${counts.parentPickupConfirmed.families} families`}
            total={active}
            tone="blue"
          />
          <ArrivalRow
            label="Parent Pickup Today Only—Bus Needed Tomorrow"
            value={counts.pickupTodayBusTomorrow.students}
            extra={`${counts.pickupTodayBusTomorrow.families} families`}
            total={active}
            tone="orange"
          />
          <ArrivalRow
            label="Confirmed Bus"
            value={counts.confirmedBus.students}
            extra={`${counts.confirmedBus.families} families`}
            total={active}
            tone="green"
          />
          <ArrivalRow
            label="Not Confirmed"
            value={counts.notConfirmed.students}
            extra={`${counts.notConfirmed.families} families`}
            total={active}
            tone="amber"
          />
        </article>
      </section>

      <section className="lead-card">
        <div className="lead-row">
          <h2>Needs Attention</h2>
          {canToggleZeros ? (
            <button
              type="button"
              className="lead-link no-print"
              onClick={() => setShowAllAttention((value) => !value)}
            >
              {showAllAttention ? "Hide zeros" : "Show all"}
            </button>
          ) : null}
        </div>
        {hot.length === 0 ? (
          <p className="lead-clear">No attention items need action right now.</p>
        ) : null}
        <div className="lead-tiles">
          {shown.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lead-tile ${item.value ? (item.urgent ? "is-hot" : "is-on") : "is-zero"}${focus === item.id ? " is-open" : ""}`}
              aria-pressed={focus === item.id}
              onClick={() => {
                if (!item.value) return;
                setFocus((current) => (current === item.id ? null : item.id));
              }}
            >
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        {focus ? (
          <div className="lead-focus">
            <div className="lead-row">
              <h3>
                {attention.find((item) => item.id === focus)?.label} · {focused.length}
              </h3>
              <button type="button" className="lead-link" onClick={() => setFocus(null)}>
                Close list
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Grade</th>
                  <th>Family</th>
                  <th>AM</th>
                  <th>PM</th>
                </tr>
              </thead>
              <tbody>
                {focused.map((student) => (
                  <tr key={student.id}>
                    <td>{student.fullName}</td>
                    <td>{student.grade}</td>
                    <td>{student.familyKey}</td>
                    <td>{AM_LABEL[student.amArrival]}</td>
                    <td>{PM_LABEL[student.pmDismissal]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="lead-card lead-defs">
        <h2>Data Definitions</h2>
        <dl>
          <div>
            <dt>Active student total</dt>
            <dd>{active}</dd>
          </div>
          <div>
            <dt>Active families</dt>
            <dd>{counts.totalFamilies}</dd>
          </div>
          <div>
            <dt>Workbook before exclusions</dt>
            <dd>
              {importSummary
                ? `${importSummary.sourceStudents} students / ${importSummary.sourceFamilies} families`
                : "125 students / 70 families"}
            </dd>
          </div>
          <div>
            <dt>Students excluded as Not Returning</dt>
            <dd>{importSummary?.excludedNotReturning ?? "—"}</dd>
          </div>
          <div>
            <dt>Duplicate records excluded</dt>
            <dd>{importSummary?.duplicateNameRows ?? "—"}</dd>
          </div>
          <div>
            <dt>Import date</dt>
            <dd>{importDate}</dd>
          </div>
          <div>
            <dt>Last successful import total</dt>
            <dd>
              {importSummary
                ? `${importSummary.created + importSummary.updated} saved · roster ${importSummary.rosterStudents}`
                : `${active} on the current roster`}
            </dd>
          </div>
        </dl>
        <p>
          Dashboard totals use the same active roster as The Gate. The latest
          workbook contains 125 records and 70 families before Not Returning and
          other active-enrollment exclusions. AM categories add up to {active}{" "}
          students
          {counts.parentDropOff +
            counts.busDropOff +
            counts.notCheckedIn +
            counts.confirmedAbsences ===
          active
            ? "."
            : " — refresh if a category is out of balance."}
        </p>
      </section>
    </div>
  );
}

function ArrivalRow({
  label,
  value,
  extra,
  total,
  tone,
}: {
  label: string;
  value: number;
  extra?: string;
  total: number;
  tone: string;
}) {
  return (
    <div className="lead-bar">
      <div className="lead-bar-top">
        <span>
          <i className={`lead-dot tone-${tone}`} />
          {label}
        </span>
        <strong>
          {value}
          {extra ? ` · ${extra}` : ""} · {pct(value, total)}%
        </strong>
      </div>
      <div className="lead-track">
        <i className={`tone-${tone}`} style={{ width: `${width(value, total)}%` }} />
      </div>
    </div>
  );
}
