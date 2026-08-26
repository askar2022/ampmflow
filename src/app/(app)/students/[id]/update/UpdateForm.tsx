"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTransportation } from "@/app/actions/transportation";
import { destinationLabel, durationLabel, planSummary, typeLabel } from "@/lib/format";
import type { Destination, DurationType, PlanSnapshot, TransportType, Trip } from "@/lib/types";

type RouteOption = { id: string; number: string; trip: string };

export function UpdateForm({
  studentId,
  studentName,
  daycareName,
  am,
  pm,
  routes,
}: {
  studentId: string;
  studentName: string;
  daycareName: string | null;
  am: PlanSnapshot;
  pm: PlanSnapshot;
  routes: RouteOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [trips, setTrips] = useState<Trip[]>(["PM"]);
  const [type, setType] = useState<TransportType>("PARENT");
  const [destination, setDestination] = useState<Destination>("HOME");
  const [duration, setDuration] = useState<DurationType>("TODAY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busRouteId, setBusRouteId] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [customAddress, setCustomAddress] = useState("");
  const [reason, setReason] = useState("");
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const selectedRoutes = routes.filter((route) =>
    trips.includes(route.trip as Trip),
  );

  const proposed = useMemo(() => {
    const bus = routes.find((r) => r.id === busRouteId);
    return {
      type,
      destination,
      busNumber: waiting ? null : bus?.number ?? null,
      waitingForAssignment: waiting,
      duration,
      customAddress,
    };
  }, [type, destination, busRouteId, waiting, duration, customAddress, routes]);

  function onWhich(value: "AM" | "PM" | "BOTH") {
    if (value === "BOTH") setTrips(["AM", "PM"]);
    else setTrips([value]);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    start(async () => {
      const result = await updateTransportation({
        studentId,
        trips,
        type,
        destination,
        duration,
        startDate,
        endDate,
        busRouteId: busRouteId || undefined,
        waitingForAssignment: waiting,
        customAddress,
        reason,
        confirmPermanent,
      });
      if (!result.ok) {
        setError(result.error);
        setWarnings(result.warnings ?? []);
        return;
      }
      router.push(`/students/${studentId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-serif text-2xl">Update transportation</h2>

        <fieldset>
          <legend className="text-sm font-semibold">Which trip?</legend>
          <div className="mt-2 flex gap-2">
            {(["AM", "PM", "BOTH"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onWhich(option)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  (option === "BOTH" && trips.length === 2) ||
                  (option !== "BOTH" && trips.length === 1 && trips[0] === option)
                    ? "bg-navy text-white"
                    : "border border-line"
                }`}
              >
                {option === "BOTH" ? "Both" : option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Transportation type</legend>
          <div className="mt-2 flex gap-2">
            <Choice
              active={type === "BUS"}
              onClick={() => setType("BUS")}
              label="Bus"
            />
            <Choice
              active={type === "PARENT"}
              onClick={() => setType("PARENT")}
              label="Parent pickup/drop-off"
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Duration</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice active={duration === "TODAY"} onClick={() => setDuration("TODAY")} label="Today only" />
            <Choice active={duration === "DATE_RANGE"} onClick={() => setDuration("DATE_RANGE")} label="Date range" />
            <Choice active={duration === "PERMANENT"} onClick={() => setDuration("PERMANENT")} label="Permanent" />
          </div>
          {duration === "DATE_RANGE" ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">
                Start
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                End
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                  required
                />
              </label>
            </div>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Destination</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice active={destination === "HOME"} onClick={() => setDestination("HOME")} label="Home" />
            <Choice
              active={destination === "DAYCARE"}
              onClick={() => setDestination("DAYCARE")}
              label={daycareName ? `Daycare (${daycareName})` : "Daycare"}
            />
            <Choice active={destination === "CUSTOM"} onClick={() => setDestination("CUSTOM")} label="Custom address" />
          </div>
          {destination === "CUSTOM" ? (
            <input
              className="mt-3 w-full rounded-xl border border-line px-3 py-2"
              placeholder="Street address"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
            />
          ) : null}
        </fieldset>

        {type === "BUS" ? (
          <fieldset>
            <legend className="text-sm font-semibold">Bus assignment</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={waiting}
                onChange={(e) => setWaiting(e.target.checked)}
              />
              Waiting for bus company assignment
            </label>
            {!waiting ? (
              <select
                className="mt-2 w-full rounded-xl border border-line px-3 py-2"
                value={busRouteId}
                onChange={(e) => setBusRouteId(e.target.value)}
              >
                <option value="">Select an existing bus number</option>
                {selectedRoutes.map((route) => (
                  <option key={route.id} value={route.id}>
                    Bus {route.number} ({route.trip})
                  </option>
                ))}
              </select>
            ) : null}
          </fieldset>
        ) : null}

        <label className="block text-sm font-semibold">
          Reason or note
          <textarea
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional"
          />
        </label>

        {duration === "PERMANENT" ? (
          <label className="flex items-start gap-2 rounded-xl bg-yellow/20 p-3 text-sm">
            <input
              type="checkbox"
              checked={confirmPermanent}
              onChange={(e) => setConfirmPermanent(e.target.checked)}
            />
            I confirm this is a permanent change to {studentName}&apos;s regular assignment.
            Today-only and date-range exceptions will still take priority when they apply.
          </label>
        ) : null}

        {error ? <p className="text-sm text-red">{error}</p> : null}
        {warnings.map((warning) => (
          <p key={warning} className="text-sm text-gold">
            {warning}
          </p>
        ))}

        <button
          disabled={pending}
          className="rounded-xl bg-navy px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save change"}
        </button>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-gold bg-card p-6">
          <h2 className="font-serif text-2xl">Review before saving</h2>
          <p className="mt-1 text-sm text-muted">
            The original plan stays on file. A today-only change expires tonight.
          </p>
          {trips.map((trip) => {
            const original = trip === "AM" ? am : pm;
            return (
              <div key={trip} className="mt-4 grid gap-3 md:grid-cols-2">
                <PlanCard title={`Original ${trip}`} plan={original} />
                <div className="rounded-xl border border-line bg-paper p-4 text-sm">
                  <div className="text-xs uppercase tracking-wider text-muted">New {trip}</div>
                  <div className="mt-2 font-semibold">
                    {type === "PARENT"
                      ? typeLabel("PARENT", trip)
                      : waiting
                        ? "Bus pending assignment"
                        : `Bus ${routes.find((r) => r.id === busRouteId)?.number ?? "—"}`}
                  </div>
                  <div>{destinationLabel(destination)}</div>
                  <div>{durationLabel(duration)}</div>
                  {proposed.customAddress ? <div>{proposed.customAddress}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          Priority used when building teacher lists:{" "}
          <strong className="text-ink">today-only</strong>, then date range, then
          the permanent assignment.
        </div>
      </aside>
    </form>
  );
}

function Choice({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm ${
        active ? "bg-navy text-white" : "border border-line"
      }`}
    >
      {label}
    </button>
  );
}

function PlanCard({ title, plan }: { title: string; plan: PlanSnapshot }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4 text-sm">
      <div className="text-xs uppercase tracking-wider text-muted">{title}</div>
      <div className="mt-2 font-semibold">{planSummary(plan, plan.trip)}</div>
      <div>{typeLabel(plan.type, plan.trip)}</div>
      <div>{destinationLabel(plan.destination)}</div>
    </div>
  );
}
