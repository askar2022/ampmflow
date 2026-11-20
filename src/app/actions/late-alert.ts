"use server";

import { getSession } from "@/lib/auth";
import {
  canCompanyAccessSchool,
  loadCompanySchools,
} from "@/lib/company-access";
import {
  lateAlertSms,
  lateDelayOptions,
  loadLateAlertRecipients,
  loadLateRides,
  uniqueFamilyPhones,
  type LateDelayMinutes,
} from "@/lib/late-alert";
import {
  lateAlertStaffSmsNumbers,
  loadLateAlertStaffPhones,
  saveLateAlertStaffPhones,
  type LateAlertStaffPhones,
} from "@/lib/late-alert-staff";
import {
  formatSmsMoney,
  loadCompanySmsCostReport,
  SMS_COST_CENTS,
} from "@/lib/sms-cost";
import type { Trip } from "@/lib/types";

const SMS_PAUSED_MESSAGE =
  "Late Bus SMS is paused. Preview only — no texts send until the bus company agrees to pay for SMS.";

function parseDelay(value: number): LateDelayMinutes | null {
  return (
    lateDelayOptions().find((option) => option.minutes === value)?.minutes ||
    null
  );
}

export async function lateAlertPreview(input: {
  schoolId: string;
  rideKey: string;
  minutes: number;
  trips?: Trip[];
}) {
  const user = await getSession();
  if (!user || user.role !== "BUS_COMPANY") {
    return { ok: false as const, error: "Only the bus company can send this alert." };
  }
  if (!(await canCompanyAccessSchool(user, input.schoolId))) {
    return { ok: false as const, error: "That school is not on your list." };
  }

  const minutes = parseDelay(input.minutes);
  if (!minutes) {
    return { ok: false as const, error: "Choose how late the bus or van is." };
  }

  const trips = (input.trips || ["PM"]).filter(
    (trip): trip is Trip => trip === "AM" || trip === "PM",
  );
  const { ride, recipients } = await loadLateAlertRecipients({
    schoolId: input.schoolId,
    rideKey: input.rideKey,
    trips,
  });
  if (!ride) {
    return { ok: false as const, error: "Choose a bus or van." };
  }

  const familyPhones = uniqueFamilyPhones(recipients);
  const staff = await loadLateAlertStaffPhones(input.schoolId);
  const staffPhones = lateAlertStaffSmsNumbers(staff).filter(
    (phone) => !familyPhones.includes(phone),
  );
  const totalTexts = familyPhones.length + staffPhones.length;
  const estimatedCents = totalTexts * SMS_COST_CENTS;
  return {
    ok: true as const,
    rideLabel: ride.label,
    minutes,
    familyCount: familyPhones.length,
    staffCount: staffPhones.length,
    studentCount: recipients.length,
    preview: lateAlertSms({ rideLabel: ride.label, minutes }),
    smsReady: false,
    sendingEnabled: false,
    estimatedCents,
    estimatedCostLabel: formatSmsMoney(estimatedCents),
  };
}

/** Never texts parents while SMS billing is not approved. */
export async function sendLateBusAlert(_input: {
  schoolId: string;
  rideKey: string;
  minutes: number;
  trips?: Trip[];
}) {
  void _input;
  return { ok: false as const, error: SMS_PAUSED_MESSAGE };
}

export async function listLateRides(schoolId: string) {
  const user = await getSession();
  if (!user || user.role !== "BUS_COMPANY") {
    return { ok: false as const, error: "Only the bus company can use this." };
  }
  if (!(await canCompanyAccessSchool(user, schoolId))) {
    return { ok: false as const, error: "That school is not on your list." };
  }
  const rides = await loadLateRides(schoolId);
  return { ok: true as const, rides };
}

export async function loadSmsCostPopup(schoolId?: string) {
  const user = await getSession();
  if (!user || user.role !== "BUS_COMPANY") {
    return { ok: false as const, error: "Only the bus company can view this." };
  }
  const schools = await loadCompanySchools(user);
  const schoolIds = schools.map((school) => school.id);
  if (schoolId && !(await canCompanyAccessSchool(user, schoolId))) {
    return { ok: false as const, error: "That school is not on your list." };
  }
  const report = await loadCompanySmsCostReport({
    actorId: user.id,
    schoolIds,
    schoolId: schoolId || undefined,
  });
  return { ok: true as const, report };
}

export async function saveCompanyLateAlertStaff(input: {
  schoolId: string;
  phone1: string;
  phone2: string;
}) {
  const user = await getSession();
  if (!user || user.role !== "BUS_COMPANY") {
    return { ok: false as const, error: "Only the bus company can save this." };
  }
  if (!(await canCompanyAccessSchool(user, input.schoolId))) {
    return { ok: false as const, error: "That school is not on your list." };
  }
  const phones: LateAlertStaffPhones = {
    phone1: input.phone1,
    phone2: input.phone2,
  };
  const saved = await saveLateAlertStaffPhones(input.schoolId, phones);
  if (!saved.ok) return saved;
  return { ok: true as const, phones: saved.phones };
}
