"use client";

import { useState } from "react";
import { createChangeRequest } from "@/app/actions/requests";
import { StudentPicker, type StudentOption } from "@/components/StudentPicker";

type RequestKind = "TODAY_CHANGE" | "COMPANY_REPORT";
type ChangeTo = "PARENT" | "BUS_TO_BUS";
type CompanyNeed = "MOVE" | "DAYCARE" | "PICKUP_TO_BUS";

export function TodayChangeForm({
  students,
  busNumbers,
  defaultStudentId = "",
  defaultCaller = "PARENT_TO_SCHOOL",
  canApplyToday = false,
}: {
  students: StudentOption[];
  busNumbers: string[];
  defaultStudentId?: string;
  defaultCaller?:
    | "PARENT_TO_SCHOOL"
    | "PARENT_TO_COMPANY"
    | "COMPANY_TO_SCHOOL";
  canApplyToday?: boolean;
}) {
  const [kind, setKind] = useState<RequestKind>("TODAY_CHANGE");
  const [changeTo, setChangeTo] = useState<ChangeTo>("PARENT");
  const [companyNeed, setCompanyNeed] = useState<CompanyNeed>("MOVE");
  const submitLabel =
    kind === "COMPANY_REPORT"
      ? "Report to bus company"
      : canApplyToday
        ? "Save today’s change"
        : "Submit for approval";

  return (
    <form action={createChangeRequest} className="mt-4 space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <label className="block text-sm font-medium">
        Student
        <StudentPicker defaultId={defaultStudentId} students={students} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What kind of request?</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            checked={kind === "TODAY_CHANGE"}
            onChange={() => setKind("TODAY_CHANGE")}
            className="mt-1"
          />
          <span>
            <strong>Today’s ride</strong> — bus to parent pickup, or bus to a
            different bus for today. The school can apply this.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            checked={kind === "COMPANY_REPORT"}
            onChange={() => setKind("COMPANY_REPORT")}
            className="mt-1"
          />
          <span>
            <strong>Report to the bus company</strong> — moving / new address,
            daycare change, or parent pickup to bus. The school cannot assign
            the new bus.
          </span>
        </label>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Who asked?</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="caller"
            value="PARENT_TO_SCHOOL"
            defaultChecked={defaultCaller === "PARENT_TO_SCHOOL"}
          />
          Parent called the school
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="caller"
            value="PARENT_TO_COMPANY"
            defaultChecked={defaultCaller === "PARENT_TO_COMPANY"}
          />
          Parent called the bus company
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="caller"
            value="COMPANY_TO_SCHOOL"
            defaultChecked={defaultCaller === "COMPANY_TO_SCHOOL"}
          />
          Bus company asked the school
        </label>
      </fieldset>
      {kind === "TODAY_CHANGE" ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Today’s change</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="changeTo"
                value="PARENT"
                checked={changeTo === "PARENT"}
                onChange={() => setChangeTo("PARENT")}
              />
              Bus → parent pickup
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="changeTo"
                value="BUS_TO_BUS"
                checked={changeTo === "BUS_TO_BUS"}
                onChange={() => setChangeTo("BUS_TO_BUS")}
              />
              Bus → different bus
            </label>
          </fieldset>
          <label className="block text-sm font-medium">
            Trip
            <select name="trip" className="mt-1 w-full rounded-xl border border-line px-3 py-2">
              <option value="PM">PM</option>
              <option value="AM">AM</option>
            </select>
          </label>
          {changeTo === "BUS_TO_BUS" ? (
            <>
              <label className="block text-sm font-medium">
                Current bus
                <input
                  name="fromBusNumber"
                  list="from-bus-numbers"
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                  placeholder="e.g. 4"
                />
                <datalist id="from-bus-numbers">
                  {busNumbers.map((number) => (
                    <option key={number} value={number}>
                      Bus {number}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="block text-sm font-medium">
                New bus today
                <input
                  name="busNumber"
                  list="bus-numbers"
                  required
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                  placeholder="e.g. 5"
                />
                <datalist id="bus-numbers">
                  {busNumbers.map((number) => (
                    <option key={number} value={number}>
                      Bus {number}
                    </option>
                  ))}
                </datalist>
              </label>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Going to</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="destination" value="HOME" defaultChecked />
                  Home
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="destination" value="DAYCARE" />
                  Daycare
                </label>
              </fieldset>
            </>
          ) : (
            <input type="hidden" name="destination" value="HOME" />
          )}
        </>
      ) : (
        <>
          <input type="hidden" name="trip" value="PM" />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              What should the bus company do?
            </legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="companyNeed"
                value="MOVE"
                checked={companyNeed === "MOVE"}
                onChange={() => setCompanyNeed("MOVE")}
                className="mt-1"
              />
              <span>Moving / new home address</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="companyNeed"
                value="DAYCARE"
                checked={companyNeed === "DAYCARE"}
                onChange={() => setCompanyNeed("DAYCARE")}
                className="mt-1"
              />
              <span>Daycare change or new daycare</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="companyNeed"
                value="PICKUP_TO_BUS"
                checked={companyNeed === "PICKUP_TO_BUS"}
                onChange={() => setCompanyNeed("PICKUP_TO_BUS")}
                className="mt-1"
              />
              <span>Parent pickup → bus</span>
            </label>
          </fieldset>
          <p className="rounded-xl bg-paper px-3 py-2 text-sm text-muted">
            This does not put the student on a new bus. It goes to the bus
            company as waiting for a route.
          </p>
          {companyNeed === "MOVE" ? (
            <label className="block text-sm font-medium">
              New home address
              <input
                name="homeAddress"
                required
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                placeholder="Street, city, and ZIP if the parent gave them"
              />
            </label>
          ) : null}
          {companyNeed === "DAYCARE" ? (
            <>
              <label className="block text-sm font-medium">
                Daycare name
                <input
                  name="daycareName"
                  required
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                  placeholder="Name of the daycare"
                />
              </label>
              <label className="block text-sm font-medium">
                Daycare address
                <input
                  name="daycareAddress"
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                  placeholder="Street address if the parent gave it"
                />
              </label>
            </>
          ) : null}
        </>
      )}
      <label className="block text-sm font-medium">
        Notes
        <textarea
          name="details"
          rows={3}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          placeholder={
            kind === "COMPANY_REPORT"
              ? "What the parent asked the bus company to do"
              : "Example: Friday — no daycare, ride home bus 5"
          }
        />
      </label>
      <button className="rounded-xl bg-navy px-4 py-2 font-semibold text-white">
        {submitLabel}
      </button>
    </form>
  );
}
