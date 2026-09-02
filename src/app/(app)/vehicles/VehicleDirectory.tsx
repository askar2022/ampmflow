"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignStudentVehicleAction,
  saveVehicleAction,
} from "@/app/actions/gate";
import type { GateStudent } from "@/lib/gate";

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
};

export function VehicleDirectory({
  vehicles,
  students,
}: {
  vehicles: Vehicle[];
  students: GateStudent[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const matched = students.filter((student) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return (
      student.fullName.toLowerCase().includes(q) ||
      student.parentName.toLowerCase().includes(q) ||
      student.parentPhone.includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <form
        className="rounded-2xl border border-line bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            const result = await saveVehicleAction(data);
            setMessage(
              result.ok
                ? "Vehicle saved. Every student on this vehicle will show the driver."
                : result.error || "Could not save.",
            );
            router.refresh();
          });
        }}
      >
        <h2 className="font-serif text-2xl">Add or update a vehicle</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="id" />
          <input
            name="name"
            required
            className="min-h-12 rounded-xl border border-line px-3"
            placeholder="Bus 3, Van A, Paratransit"
          />
          <select
            name="vehicleType"
            className="gate-select"
            defaultValue="BUS"
          >
            <option value="BUS">Bus</option>
            <option value="VAN">Van</option>
            <option value="PARATRANSIT">Paratransit</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            name="driverName"
            className="min-h-12 rounded-xl border border-line px-3"
            placeholder="Driver name"
          />
          <input
            name="driverPhone"
            className="min-h-12 rounded-xl border border-line px-3"
            placeholder="Driver phone"
          />
          <button
            type="submit"
            disabled={pending}
            className="action-button rounded-xl px-4 text-sm font-bold"
          >
            Save vehicle
          </button>
        </div>
      </form>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3">Assigned Vehicle/Route</th>
              <th>Type</th>
              <th>Driver name</th>
              <th>Driver phone</th>
              <th>Students</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3 font-semibold">Not Assigned</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>
                {students.filter((s) => s.vehicleName === "Not Assigned").length}
              </td>
            </tr>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td className="px-4 py-3 font-semibold">{vehicle.name}</td>
                <td>{vehicle.vehicleType}</td>
                <td>{vehicle.driverName || "—"}</td>
                <td>{vehicle.driverPhone || "—"}</td>
                <td>
                  {students.filter((s) => s.vehicleName === vehicle.name).length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Look up a student</h2>
        <input
          className="mt-3 min-h-12 w-full max-w-xl rounded-xl border border-line px-3"
          placeholder="Student or parent name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-4 space-y-3">
          {matched.slice(0, 12).map((student) => (
            <div
              key={student.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3"
            >
              <div>
                <div className="font-semibold">{student.fullName}</div>
                <div className="text-sm text-muted">
                  {student.grade} · {student.parentName} · {student.parentPhone}
                </div>
                <div className="text-sm">
                  {student.vehicleName}
                  {student.driverName ? ` · ${student.driverName}` : ""}
                  {student.driverPhone ? ` · ${student.driverPhone}` : ""}
                </div>
              </div>
              <select
                className="gate-select"
                value={
                  vehicles.find((v) => v.name === student.vehicleName)?.id ||
                  "NOT_ASSIGNED"
                }
                onChange={(event) => {
                  start(async () => {
                    await assignStudentVehicleAction(
                      student.id,
                      event.target.value,
                    );
                    router.refresh();
                  });
                }}
              >
                <option value="NOT_ASSIGNED">Not Assigned</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
