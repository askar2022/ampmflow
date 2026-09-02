-- Additive first-day arrival / dismissal tables.
-- Safe to run more than once. Does not delete existing student or transportation data.

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "familyId" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "enrollmentSource" TEXT NOT NULL DEFAULT 'RETURNING';
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "vehicleId" TEXT;

CREATE TABLE IF NOT EXISTS "Family" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "familyKey" TEXT NOT NULL,
  "reviewNeeded" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Family_schoolId_familyKey_key"
  ON "Family"("schoolId", "familyKey");

CREATE TABLE IF NOT EXISTS "TransportVehicle" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "vehicleType" TEXT NOT NULL DEFAULT 'BUS',
  "driverName" TEXT NOT NULL DEFAULT '',
  "driverPhone" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransportVehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TransportVehicle_schoolId_name_key"
  ON "TransportVehicle"("schoolId", "name");

CREATE TABLE IF NOT EXISTS "GateDayStatus" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "amArrival" TEXT NOT NULL DEFAULT 'NOT_CHECKED_IN',
  "amFollowUp" TEXT NOT NULL DEFAULT 'FOLLOW_UP_NOT_NEEDED',
  "pmDismissal" TEXT NOT NULL DEFAULT 'NOT_CONFIRMED',
  "transportNotes" TEXT NOT NULL DEFAULT '',
  "tempVehicleName" TEXT NOT NULL DEFAULT '',
  "amArrivalAt" TIMESTAMP(3),
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GateDayStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GateDayStatus_studentId_date_key"
  ON "GateDayStatus"("studentId", "date");

ALTER TABLE "GateDayStatus" ADD COLUMN IF NOT EXISTS "tempVehicleName" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "GateStatusHistory" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "previous" TEXT NOT NULL,
  "next" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GateStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GradeDismissalConfirm" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'WAITING_TEACHER',
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GradeDismissalConfirm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GradeDismissalConfirm_schoolId_date_grade_key"
  ON "GradeDismissalConfirm"("schoolId", "date", "grade");
