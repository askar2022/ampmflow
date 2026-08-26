ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "assignedBus" TEXT;

CREATE TABLE IF NOT EXISTS "SchoolSettings" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL UNIQUE REFERENCES "School"("id"),
  "changeDeadline" TEXT NOT NULL DEFAULT '14:15',
  "snapshotTime" TEXT NOT NULL DEFAULT '14:45',
  "weeklyReportTime" TEXT NOT NULL DEFAULT '12:00'
);

CREATE TABLE IF NOT EXISTS "ChangeEvent" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "studentId" TEXT NOT NULL REFERENCES "Student"("id"),
  "trip" TEXT NOT NULL,
  "previousPlan" TEXT NOT NULL,
  "newPlan" TEXT NOT NULL,
  "durationType" TEXT NOT NULL,
  "late" BOOLEAN NOT NULL DEFAULT FALSE,
  "urgent" BOOLEAN NOT NULL DEFAULT FALSE,
  "waitingForRoute" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdById" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TeacherAcknowledgment" (
  "id" TEXT PRIMARY KEY,
  "changeEventId" TEXT NOT NULL REFERENCES "ChangeEvent"("id"),
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "acknowledgedAt" TIMESTAMP(3),
  UNIQUE ("changeEventId", "userId")
);

CREATE TABLE IF NOT EXISTS "BusCheckIn" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "studentId" TEXT NOT NULL REFERENCES "Student"("id"),
  "trip" TEXT NOT NULL DEFAULT 'PM',
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "checkedById" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("studentId", "trip", "date")
);

ALTER TABLE "SchoolSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChangeEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherAcknowledgment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusCheckIn" ENABLE ROW LEVEL SECURITY;
