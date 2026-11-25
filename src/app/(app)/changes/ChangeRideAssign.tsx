"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nearbyAssignmentSuggestion } from "@/app/actions/nearby-assignment";
import {
  assignRequestedBus,
  sendAssignedBusNotice,
} from "@/app/actions/reception";
import type { NearbyAssignment } from "@/lib/nearby-assignment";
import type { Trip } from "@/lib/types";

type TripChoice = "AM" | "PM" | "BOTH";

type NotifyDraft = {
  assigned: string;
  trips: Trip[];
  previous: string;
  next: string;
  when: string;
  note: string;
  amPickup: string;
  pmPickup: string;
  parentEmail: string;
  parentPhone: string;
  parentPhone2: string;
  teacherEmail: string;
  busCompanyEmail: string;
  coordinatorEmail: string;
  frontDeskEmail: string;
  sendParentSms: boolean;
};

type Receipt = {
  assigned: string;
  sent: string[];
  skipped: string[];
  parentEmail: string;
  parentPhone: string;
  parentPhone2?: string;
  teacherEmail: string;
  busCompanyEmail: string;
  coordinatorEmail?: string;
  frontDeskEmail?: string;
};

type NearbyStatus = "idle" | "loading" | "found" | "none" | "dismissed";

function startingTrip(defaultTrips?: Trip[]): TripChoice {
  const am = defaultTrips?.includes("AM");
  const pm = defaultTrips?.includes("PM");
  if (am && pm) return "BOTH";
  if (am) return "AM";
  return "PM";
}

function statusFor(receipt: Receipt, label: string) {
  const sent = receipt.sent.find((item) =>
    item.toLowerCase().startsWith(label.toLowerCase()),
  );
  const skipped = receipt.skipped.find((item) =>
    item.toLowerCase().includes(label.toLowerCase()),
  );
  if (sent) return "Sent";
  if (skipped) return "Not sent";
  return "—";
}

export function ChangeRideAssign({
  requestId,
  studentId,
  studentName,
  grade,
  request,
  sitting = "",
  effectiveDate = "",
  buses = [],
  vans = [],
  hideVan = false,
  defaultTrips,
  companyAssigned = false,
  parentEmail = "",
  parentPhone = "",
  teacherEmail = "",
  nearbyEnabled = false,
}: {
  requestId?: string;
  studentId: string;
  studentName: string;
  grade: string;
  request?: string;
  sitting?: string;
  effectiveDate?: string;
  buses?: string[];
  vans?: { id: string; name: string }[];
  hideVan?: boolean;
  defaultTrips?: Trip[];
  companyAssigned?: boolean;
  parentEmail?: string;
  parentPhone?: string;
  teacherEmail?: string;
  nearbyEnabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [done, setDone] = useState(companyAssigned);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [draft, setDraft] = useState<NotifyDraft | null>(null);
  const [trip, setTrip] = useState<TripChoice>(startingTrip(defaultTrips));
  const [busNumber, setBusNumber] = useState("");
  const [vanNumber, setVanNumber] = useState("");
  const [amPickup, setAmPickup] = useState("");
  const [pmPickup, setPmPickup] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>("idle");
  const [nearby, setNearby] = useState<NearbyAssignment | null>(null);
  const nearbyDismissed = useRef(false);

  function close() {
    if (pending) return;
    setOpen(false);
    setReview(false);
    setDraft(null);
    setError("");
    setNearbyStatus("idle");
    setNearby(null);
    nearbyDismissed.current = false;
  }

  function patchDraft(patch: Partial<NotifyDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  useEffect(() => {
    if (!open || review || !nearbyEnabled || nearbyDismissed.current) return;
    let cancelled = false;
    const trips: Trip[] = trip === "BOTH" ? ["AM", "PM"] : [trip];
    setNearbyStatus("loading");
    nearbyAssignmentSuggestion({ studentId, trips })
      .then((result) => {
        if (cancelled || nearbyDismissed.current) return;
        if (result.ok && result.found) {
          setNearby({
            address: result.address,
            trip: result.trip,
            ride: result.ride,
            vehicle: result.vehicle,
            fill: result.fill,
            miles: result.miles,
          });
          setNearbyStatus("found");
          return;
        }
        setNearby(null);
        setNearbyStatus("none");
      })
      .catch(() => {
        if (cancelled || nearbyDismissed.current) return;
        setNearby(null);
        setNearbyStatus("none");
      });
    return () => {
      cancelled = true;
    };
  }, [open, review, nearbyEnabled, studentId, trip]);

  function dismissNearby() {
    nearbyDismissed.current = true;
    setNearbyStatus("dismissed");
  }

  function applyNearby() {
    if (!nearby) return;
    if (nearby.vehicle === "van") {
      const match = vans.find(
        (van) =>
          van.name.toLowerCase() === nearby.fill.toLowerCase() ||
          van.name.toLowerCase() === `van ${nearby.fill}`.toLowerCase() ||
          nearby.fill.toLowerCase() === van.name.replace(/^van\s+/i, "").toLowerCase(),
      );
      setVanNumber(match?.name || nearby.fill);
      setBusNumber("");
    } else {
      setBusNumber(nearby.fill);
      setVanNumber("");
    }
    dismissNearby();
  }

  function assign() {
    const bus = busNumber.trim();
    const van = hideVan ? "" : vanNumber.trim();
    if (bus && van) {
      setError("Type the bus number only.");
      return;
    }
    if (!bus && !van) {
      setError(
        hideVan
          ? "Choose Bus 4, Bus 5, or the 3rd bus."
          : buses.length || vans.length
            ? "Choose a bus or a van — not both."
            : "Type the bus or van number.",
      );
      return;
    }
    if (van && (/^0$|^van\s*0$/i.test(van) || van.replace(/^van\s+/i, "") === "0")) {
      setError("Van 0 is not valid. Choose Van 1–Van 9.");
      return;
    }
    const trips: Trip[] = trip === "BOTH" ? ["AM", "PM"] : [trip];
    if ((trip === "AM" || trip === "BOTH") && !amPickup.trim()) {
      setError("Type the AM pickup time.");
      return;
    }
    if ((trip === "PM" || trip === "BOTH") && !pmPickup.trim()) {
      setError("Type the PM pickup time.");
      return;
    }
    setError("");
    start(async () => {
      const result = await assignRequestedBus({
        requestId,
        studentId,
        busNumber: bus || van,
        vehicle: van && !bus ? "van" : "bus",
        trips,
        amPickupTime: amPickup.trim(),
        pmPickupTime: pmPickup.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Only the emails from this school request (empty = school left it blank).
      setDraft({
        assigned: result.assigned,
        trips: result.trips,
        previous: result.previous,
        next: result.next,
        when: result.when,
        note: result.note,
        amPickup: result.amPickup,
        pmPickup: result.pmPickup,
        parentEmail: result.parentEmail || "",
        parentPhone: result.parentPhone || "",
        parentPhone2: result.parentPhone2 || "",
        teacherEmail: result.teacherEmail || "",
        busCompanyEmail: result.busCompanyEmail || "",
        coordinatorEmail: result.coordinatorEmail || "",
        frontDeskEmail: result.frontDeskEmail || "",
        sendParentSms: Boolean(
          (result.parentPhone || "").trim() || (result.parentPhone2 || "").trim(),
        ),
      });
      setReceipt(null);
      setBusNumber("");
      setVanNumber("");
      setAmPickup("");
      setPmPickup("");
      setDone(true);
      setReview(true);
      void Promise.resolve().then(() => router.refresh());
    });
  }

  function sendNotice() {
    if (!draft) return;
    setError("");
    start(async () => {
      const result = await sendAssignedBusNotice({
        studentId,
        trips: draft.trips,
        previous: draft.previous,
        next: draft.next,
        when: draft.when,
        note: draft.note,
        amPickup: draft.amPickup,
        pmPickup: draft.pmPickup,
        parentEmail: draft.parentEmail,
        parentPhone: draft.parentPhone,
        parentPhone2: draft.parentPhone2,
        teacherEmail: draft.teacherEmail,
        busCompanyEmail: draft.busCompanyEmail,
        coordinatorEmail: draft.coordinatorEmail,
        frontDeskEmail: draft.frontDeskEmail,
        sendParentSms: draft.sendParentSms,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReceipt({
        assigned: draft.assigned,
        sent: result.sent,
        skipped: result.skipped,
        parentEmail: result.parentEmail,
        parentPhone: result.parentPhone,
        parentPhone2: result.parentPhone2,
        teacherEmail: result.teacherEmail,
        busCompanyEmail: result.busCompanyEmail,
        coordinatorEmail: result.coordinatorEmail,
        frontDeskEmail: result.frontDeskEmail,
      });
      setDraft(null);
    });
  }

  function skipNotice() {
    if (!draft) {
      close();
      return;
    }
    setReceipt({
      assigned: draft.assigned,
      sent: [],
      skipped: [
        "parent (not sent — skipped)",
        "teacher (not sent — skipped)",
        "bus company (not sent — skipped)",
        "school (not sent — skipped)",
        "parent text (not sent — skipped)",
      ],
      parentEmail: draft.parentEmail,
      parentPhone: draft.parentPhone,
      parentPhone2: draft.parentPhone2,
      teacherEmail: draft.teacherEmail,
      busCompanyEmail: draft.busCompanyEmail,
      coordinatorEmail: draft.coordinatorEmail,
      frontDeskEmail: draft.frontDeskEmail,
    });
    setDraft(null);
  }

  const changed = done || companyAssigned;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setReview(changed && Boolean(receipt || draft));
          setError("");
        }}
        className={`rounded-full px-4 py-2 text-sm font-semibold ${
          changed ? "bg-green text-white" : "bg-yellow text-white"
        }`}
      >
        {changed ? "Changed" : "Need Update"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`company-update-${studentId}`}
          onClick={close}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={`company-update-${studentId}`}
              className="font-serif text-2xl text-navy"
            >
              {studentName}
            </h3>
            <p className="mt-0.5 text-sm text-muted">Grade {grade}</p>
            {request ? (
              <p className="mt-1 text-sm font-extrabold text-navy">{request}</p>
            ) : null}
            {sitting ? (
              <p className="mt-1 text-sm font-semibold text-navy">
                Where student sits · {sitting}
              </p>
            ) : null}
            {effectiveDate ? (
              <p className="mt-0.5 text-sm text-muted">Effective {effectiveDate}</p>
            ) : null}

            {review && draft ? (
              <div className="mt-5 space-y-4">
                <p className="font-semibold text-navy">
                  {draft.assigned} saved — review who gets the update
                </p>
                <p className="text-sm text-muted">
                  These are the emails the school typed on this request — not
                  other saved school emails. Clear a row to skip it, or edit
                  before you send. Blank means the school did not include that
                  contact.
                </p>
                <div className="space-y-3">
                  {(
                    [
                      ["parentEmail", "Parent email"],
                      ["teacherEmail", "Teacher email"],
                      ["busCompanyEmail", "Bus company email"],
                      ["coordinatorEmail", "Bus coordinator email"],
                      ["frontDeskEmail", "Front desk email"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-sm font-semibold">
                      {label}
                      <div className="mt-1 flex gap-2">
                        <input
                          type="email"
                          value={draft[key]}
                          onChange={(event) =>
                            patchDraft({ [key]: event.target.value })
                          }
                          placeholder="Leave blank to skip"
                          className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-base font-medium text-navy"
                        />
                        <button
                          type="button"
                          onClick={() => patchDraft({ [key]: "" })}
                          className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </label>
                  ))}
                  <label className="block text-sm font-semibold">
                    Parent text phone
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={draft.parentPhone}
                        onChange={(event) =>
                          patchDraft({ parentPhone: event.target.value })
                        }
                        placeholder="Leave blank to skip text"
                        className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-base font-medium text-navy"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchDraft({
                            parentPhone: "",
                            parentPhone2: "",
                            sendParentSms: false,
                          })
                        }
                        className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={draft.sendParentSms}
                      onChange={(event) =>
                        patchDraft({ sendParentSms: event.target.checked })
                      }
                    />
                    Also send parent text
                  </label>
                </div>
                {error ? <p className="text-sm text-red">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={sendNotice}
                    className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? "Sending…" : "Send update"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={skipNotice}
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    Done without sending
                  </button>
                </div>
              </div>
            ) : review && receipt ? (
              <div className="mt-5 space-y-4">
                <p className="font-semibold text-navy">
                  {receipt.assigned} assigned
                </p>
                <div>
                  <div className="text-sm font-semibold">Who got the update</div>
                  <ul className="mt-2 space-y-2 text-sm">
                    <li className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2">
                      <span>Parent text · {receipt.parentPhone || "—"}</span>
                      <span className="font-semibold">
                        {statusFor(receipt, "parent text")}
                      </span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2">
                      <span>Parent email · {receipt.parentEmail || "—"}</span>
                      <span className="font-semibold">
                        {statusFor(receipt, "parent:")}
                      </span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2">
                      <span>Teacher · {receipt.teacherEmail || "—"}</span>
                      <span className="font-semibold">
                        {statusFor(receipt, "teacher")}
                      </span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2">
                      <span>
                        Bus company · {receipt.busCompanyEmail || "—"}
                      </span>
                      <span className="font-semibold">
                        {statusFor(receipt, "bus company")}
                      </span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2">
                      <span>
                        Coordinator · {receipt.coordinatorEmail || "—"}
                      </span>
                      <span className="font-semibold">
                        {statusFor(receipt, "school")}
                      </span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2">
                      <span>
                        Front desk · {receipt.frontDeskEmail || "—"}
                      </span>
                      <span className="font-semibold">
                        {statusFor(receipt, "school")}
                      </span>
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-muted">
                  If the family did not get it, check these and fix them on
                  Front Desk.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReview(false);
                      setDraft(null);
                      setReceipt(null);
                    }}
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
                  >
                    Update again
                  </button>
                  <Link
                    href={`/dashboard?student=${studentId}`}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-muted underline"
                  >
                    Fix contacts
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {nearbyEnabled && nearbyStatus === "loading" ? (
                  <p className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-muted">
                    Checking nearby stops…
                  </p>
                ) : null}
                {nearbyEnabled && nearbyStatus === "found" && nearby ? (
                  <div className="mt-3 rounded-lg border border-line bg-paper px-3 py-2.5">
                    <p className="text-xs font-semibold text-navy">
                      Nearby reference
                    </p>
                    <p className="mt-1 text-sm font-semibold text-navy">
                      {nearby.address}
                      {nearby.miles != null
                        ? ` · ${nearby.miles.toFixed(1)} mi approx.`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-navy">
                      Suggested assignment: {nearby.ride}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Reference only—confirm in your routing system.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={applyNearby}
                        className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white"
                      >
                        Use suggestion
                      </button>
                      <button
                        type="button"
                        onClick={dismissNearby}
                        className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold"
                      >
                        Continue without suggestion
                      </button>
                    </div>
                  </div>
                ) : null}
                {nearbyEnabled && nearbyStatus === "none" ? (
                  <p className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-muted">
                    No nearby assignment available. Assign below.
                  </p>
                ) : null}
                {buses.length ? (
                  <div className="mt-3">
                    <div className="text-sm font-semibold">
                      {hideVan ? "Aim buses" : "Buses"}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {buses.map((number) => {
                        const label = /^3rd/i.test(number)
                          ? "3rd bus"
                          : `Bus ${number}`;
                        const on = busNumber.trim() === number;
                        return (
                          <button
                            key={number}
                            type="button"
                            onClick={() => {
                              setBusNumber(number);
                              setVanNumber("");
                            }}
                            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                              on
                                ? "bg-navy text-white"
                                : "border border-line bg-paper"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {!hideVan && vans.length ? (
                  <div className="mt-3">
                    <div className="text-sm font-semibold">Vans</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {vans.map((van) => {
                        const on =
                          vanNumber.trim().toLowerCase() ===
                            van.name.toLowerCase() ||
                          vanNumber.trim() ===
                            van.name.replace(/^Van\s+/i, "");
                        return (
                          <button
                            key={van.id}
                            type="button"
                            onClick={() => {
                              setVanNumber(van.name);
                              setBusNumber("");
                            }}
                            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                              on
                                ? "bg-navy text-white"
                                : "border border-line bg-paper"
                            }`}
                          >
                            {van.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div
                  className={`mt-3 grid gap-2 ${hideVan ? "" : "sm:grid-cols-2"}`}
                >
                  <label className="block text-sm font-semibold">
                    Bus number
                    <input
                      autoFocus
                      list={`company-buses-${studentId}`}
                      value={busNumber}
                      onChange={(event) => {
                        setBusNumber(event.target.value);
                        if (event.target.value.trim()) setVanNumber("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          assign();
                        }
                      }}
                      placeholder={
                        hideVan
                          ? "4, 5, or 3rd bus"
                          : buses.length
                            ? buses.join(" or ")
                            : "1"
                      }
                      className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base font-medium text-navy"
                    />
                  </label>
                  {hideVan ? null : (
                    <label className="block text-sm font-semibold">
                      Van number
                      <input
                        list={`company-vans-${studentId}`}
                        value={vanNumber}
                        onChange={(event) => {
                          setVanNumber(event.target.value);
                          if (event.target.value.trim()) setBusNumber("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            assign();
                          }
                        }}
                        placeholder={
                          vans.length
                            ? vans[0]?.name.replace(/^Van\s+/i, "") || "1"
                            : "1"
                        }
                        className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base font-medium text-navy"
                      />
                    </label>
                  )}
                </div>
                {buses.length ? (
                  <datalist id={`company-buses-${studentId}`}>
                    {buses.map((number) => (
                      <option key={number} value={number} />
                    ))}
                  </datalist>
                ) : null}
                {!hideVan && vans.length ? (
                  <datalist id={`company-vans-${studentId}`}>
                    {vans.map((van) => (
                      <option key={van.id} value={van.name} />
                    ))}
                  </datalist>
                ) : null}

                <div className="mt-3">
                  <div className="text-sm font-semibold">Trip</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(
                      [
                        ["AM", "Morning"],
                        ["PM", "Afternoon"],
                        ["BOTH", "Both"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTrip(value)}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                          trip === value
                            ? "bg-navy text-white"
                            : "border border-line bg-paper"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {trip === "PM" ? null : (
                    <label className="block text-sm font-semibold">
                      AM pickup time
                      <input
                        type="text"
                        required
                        value={amPickup}
                        onChange={(event) => setAmPickup(event.target.value)}
                        placeholder=""
                        autoComplete="off"
                        className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base font-medium text-navy"
                      />
                    </label>
                  )}
                  {trip === "AM" ? null : (
                    <label className="block text-sm font-semibold">
                      PM pickup time
                      <input
                        type="text"
                        required
                        value={pmPickup}
                        onChange={(event) => setPmPickup(event.target.value)}
                        placeholder=""
                        autoComplete="off"
                        className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base font-medium text-navy"
                      />
                    </label>
                  )}
                </div>

                {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={assign}
                    className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? "Saving…" : "Assign"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={close}
                    className="rounded-full border border-line px-5 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
