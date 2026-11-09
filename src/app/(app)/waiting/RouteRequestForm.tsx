"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestRoute } from "@/app/actions/reception";

const empty = {
  studentId: "",
  firstName: "",
  lastName: "",
  grade: "",
  teacherName: "",
  parentPhone: "",
  parentEmail: "",
  busCompanyEmail: "",
  address: "",
  emergencyContact: "",
};

export function RouteRequestForm({
  busCompanyEmail = "",
}: {
  busCompanyEmail?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...empty, busCompanyEmail });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function setField(name: keyof typeof empty, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-4xl text-navy">Submit new request</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Fill the form once. It emails the parent and Minnehaha. The student
          then shows on Open requests until they assign Bus 4, Bus 5, or the
          3rd bus.
        </p>
      </div>

      <form
        className="rounded-2xl border border-line bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          setMessage("");
          start(async () => {
            const result = await requestRoute(form);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage(result.message);
            setForm({ ...empty, busCompanyEmail: form.busCompanyEmail });
            router.refresh();
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            First name
            <input
              required
              autoFocus
              value={form.firstName}
              onChange={(event) => setField("firstName", event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Last name
            <input
              required
              value={form.lastName}
              onChange={(event) => setField("lastName", event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Grade
            <input
              required
              value={form.grade}
              onChange={(event) => setField("grade", event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Teacher name
            <input
              value={form.teacherName}
              onChange={(event) => setField("teacherName", event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Primary 1 phone
            <input
              required
              value={form.parentPhone}
              onChange={(event) => setField("parentPhone", event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Parent email
            <input
              type="email"
              required
              value={form.parentEmail}
              onChange={(event) => setField("parentEmail", event.target.value)}
              placeholder="parent@email.com"
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Bus company email
            <input
              type="email"
              required
              value={form.busCompanyEmail}
              onChange={(event) =>
                setField("busCompanyEmail", event.target.value)
              }
              placeholder="bus@company.com"
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Student address
            <input
              required
              value={form.address}
              onChange={(event) => setField("address", event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Emergency contact
            <input
              value={form.emergencyContact}
              onChange={(event) =>
                setField("emergencyContact", event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">
            {message}
          </p>
        ) : null}

        <div className="mt-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Sending…" : "Submit request"}
          </button>
        </div>
      </form>
    </div>
  );
}
