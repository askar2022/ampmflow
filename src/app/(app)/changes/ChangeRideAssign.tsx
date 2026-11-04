"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignRequestedBus } from "@/app/actions/reception";
import type { Trip } from "@/lib/types";

type TripChoice = "AM" | "PM" | "BOTH";

type Receipt = {
  assigned: string;
  sent: string[];
  skipped: string[];
  parentEmail: string;
  parentPhone: string;
  parentPhone2?: string;
  teacherEmail: string;
  busCompanyEmail: string;
};

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
  studentId,
  studentName,
  grade,
  request,
  buses = [],
  vans = [],
  defaultTrips,
  companyAssigned = false,
  parentEmail = "",
  parentPhone = "",
  teacherEmail = "",
}: {
  studentId: string;
  studentName: string;
  grade: string;
  request?: string;
  buses?: string[];
  vans?: { id: string; name: string }[];
  defaultTrips?: Trip[];
  companyAssigned?: boolean;
  parentEmail?: string;
  parentPhone?: string;
  teacherEmail?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [done, setDone] = useState(companyAssigned);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [trip, setTrip] = useState<TripChoice>(startingTrip(defaultTrips));
  const [busNumber, setBusNumber] = useState("");
  const [vanNumber, setVanNumber] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setReview(false);
    setError("");
  }

  function assign() {
    const bus = busNumber.trim();
    const van = vanNumber.trim();
    if (bus && van) {
      setError("Type the bus or the van, not both.");
      return;
    }
    if (!bus && !van) {
      setError("Type the bus number or the van number.");
      return;
    }
    setError("");
    start(async () => {
      const result = await assignRequestedBus({
        studentId,
        busNumber: bus || van,
        vehicle: van && !bus ? "van" : "bus",
        trips: trip === "BOTH" ? ["AM", "PM"] : [trip],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReceipt({
        assigned: result.assigned,
        sent: result.sent,
        skipped: result.skipped,
        parentEmail: result.parentEmail || parentEmail,
        parentPhone: result.parentPhone || parentPhone,
        parentPhone2: result.parentPhone2,
        teacherEmail: result.teacherEmail || teacherEmail,
        busCompanyEmail: result.busCompanyEmail || "",
      });
      setBusNumber("");
      setVanNumber("");
      setDone(true);
      setReview(true);
      router.refresh();
    });
  }

  const changed = done || companyAssigned;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setReview(changed && Boolean(receipt));
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
            className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={`company-update-${studentId}`}
              className="font-serif text-3xl text-navy"
            >
              {studentName}
            </h3>
            <p className="mt-1 text-muted">Grade {grade}</p>
            {request ? (
              <p className="mt-2 text-sm font-semibold text-navy">{request}</p>
            ) : null}

            {review && receipt ? (
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
                      <span>Coordinator and Front Desk</span>
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
                    onClick={() => setReview(false)}
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
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                      placeholder="4"
                      className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-3 text-base font-medium text-navy"
                    />
                  </label>
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
                      placeholder="2"
                      className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-3 text-base font-medium text-navy"
                    />
                  </label>
                </div>
                {buses.length ? (
                  <datalist id={`company-buses-${studentId}`}>
                    {buses.map((number) => (
                      <option key={number} value={number} />
                    ))}
                  </datalist>
                ) : null}
                {vans.length ? (
                  <datalist id={`company-vans-${studentId}`}>
                    {vans.map((van) => (
                      <option key={van.id} value={van.name} />
                    ))}
                  </datalist>
                ) : null}

                <div className="mt-5">
                  <div className="text-sm font-semibold">Trip</div>
                  <div className="mt-2 flex flex-wrap gap-2">
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
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
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

                {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={assign}
                    className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? "Saving…" : "Assign"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={close}
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
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
