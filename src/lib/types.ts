export const ROLES = [
  "COORDINATOR",
  "ADMINISTRATOR",
  "TEACHER",
  "FRONT_DESK",
  "BUS_COMPANY",
  "BUS_ASSISTANT",
] as const;

export type Role = (typeof ROLES)[number];

export const TRIPS = ["AM", "PM"] as const;
export type Trip = (typeof TRIPS)[number];

export const TRANSPORT_TYPES = ["BUS", "PARENT"] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export const DESTINATIONS = ["HOME", "DAYCARE", "CUSTOM"] as const;
export type Destination = (typeof DESTINATIONS)[number];

export const DURATION_TYPES = ["TODAY", "DATE_RANGE", "PERMANENT"] as const;
export type DurationType = (typeof DURATION_TYPES)[number];

export const REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type SessionUser = {
  id: string;
  schoolId: string;
  email: string;
  name: string;
  role: Role;
  teacherId: string | null;
  assignedBus: string | null;
};

export type PlanSnapshot = {
  trip: Trip;
  type: TransportType | null;
  destination: Destination | null;
  busNumber: string | null;
  daycareName: string | null;
  customAddress: string | null;
  waitingForAssignment: boolean;
  notes: string;
  source: "TODAY" | "DATE_RANGE" | "PERMANENT" | "MISSING";
  location: string;
  startDate?: string | null;
  endDate?: string | null;
};

export type EffectiveStudent = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: string;
  parentName: string;
  parentPhone: string;
  homeAddress: string;
  daycareName: string | null;
  daycareAddress: string | null;
  classroomId: string;
  classroomName: string;
  teacherName: string;
  notes: string;
  am: PlanSnapshot;
  pm: PlanSnapshot;
  lastUpdatedBy: string | null;
  lastUpdatedAt: string | null;
};
