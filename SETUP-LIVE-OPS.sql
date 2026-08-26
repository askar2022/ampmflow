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

INSERT INTO "SchoolSettings" ("id", "schoolId", "changeDeadline", "snapshotTime", "weeklyReportTime")
SELECT 'set_riverside', "id", '14:15', '14:45', '12:00'
FROM "School"
WHERE "id" = 'sch_riverside'
ON CONFLICT ("schoolId") DO NOTHING;

INSERT INTO "User" ("id", "schoolId", "email", "name", "passwordHash", "role", "assignedBus")
SELECT
  'usr_bus4',
  "id",
  'bus4@riverside.edu',
  'Bus 4 Assistant',
  '$2b$10$lpJbSy3aiKUiyt0YYNRDyO0Cg9jnSjy4rHVkArTlbLoHgu2xTuEWq',
  'BUS_ASSISTANT',
  '4'
FROM "School"
WHERE "id" = 'sch_riverside'
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "ChangeEvent" (
  "id", "schoolId", "studentId", "trip", "previousPlan", "newPlan",
  "durationType", "late", "urgent", "waitingForRoute", "createdById"
)
SELECT
  'evt_mohammed',
  s."schoolId",
  s."id",
  'PM',
  '{"type":"BUS","busNumber":"4","destination":"DAYCARE"}',
  '{"type":"PARENT","destination":"HOME"}',
  'TODAY',
  TRUE,
  TRUE,
  FALSE,
  'usr_front'
FROM "Student" s
WHERE s."studentId" = 'RIV-1001'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TeacherAcknowledgment" ("id", "changeEventId", "userId")
SELECT 'ack_mohammed', 'evt_mohammed', u."id"
FROM "User" u
WHERE u."email" = 'hcole@riverside.edu'
ON CONFLICT ("changeEventId", "userId") DO NOTHING;
