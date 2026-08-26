-- Bus & Dismissal Tracker
-- Paste this entire file into Supabase → SQL Editor → Run
-- Project: https://iardxvlhuapmlmqqrtgr.supabase.co

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Notification" CASCADE;
DROP TABLE IF EXISTS "ChangeRequest" CASCADE;
DROP TABLE IF EXISTS "TemporaryChange" CASCADE;
DROP TABLE IF EXISTS "TransportationAssignment" CASCADE;
DROP TABLE IF EXISTS "Student" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "Teacher" CASCADE;
DROP TABLE IF EXISTS "Classroom" CASCADE;
DROP TABLE IF EXISTS "BusRoute" CASCADE;
DROP TABLE IF EXISTS "Daycare" CASCADE;
DROP TABLE IF EXISTS "Address" CASCADE;
DROP TABLE IF EXISTS "School" CASCADE;

CREATE TABLE "School" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Classroom" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "name" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Teacher" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "classroomId" TEXT NOT NULL REFERENCES "Classroom"("id"),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Address" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "line1" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zip" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT 'home',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Daycare" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "addressId" TEXT NOT NULL REFERENCES "Address"("id"),
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "teacherId" TEXT REFERENCES "Teacher"("id"),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "BusRoute" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "number" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "trip" TEXT NOT NULL,
  "loadingLocation" TEXT NOT NULL DEFAULT 'Bus loading area',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "number", "trip")
);

CREATE TABLE "Student" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "studentId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL REFERENCES "Classroom"("id"),
  "parentName" TEXT NOT NULL,
  "parentPhone" TEXT NOT NULL,
  "homeAddressId" TEXT NOT NULL REFERENCES "Address"("id"),
  "daycareId" TEXT REFERENCES "Daycare"("id"),
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "studentId")
);

CREATE TABLE "TransportationAssignment" (
  "id" TEXT PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id"),
  "trip" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "busRouteId" TEXT REFERENCES "BusRoute"("id"),
  "daycareId" TEXT REFERENCES "Daycare"("id"),
  "customAddressId" TEXT REFERENCES "Address"("id"),
  "waitingForAssignment" BOOLEAN NOT NULL DEFAULT FALSE,
  "notes" TEXT NOT NULL DEFAULT '',
  "effectiveStart" TIMESTAMP(3),
  "effectiveEnd" TIMESTAMP(3),
  "updatedById" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("studentId", "trip")
);

CREATE TABLE "TemporaryChange" (
  "id" TEXT PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id"),
  "trip" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "busRouteId" TEXT REFERENCES "BusRoute"("id"),
  "daycareId" TEXT REFERENCES "Daycare"("id"),
  "customAddressId" TEXT REFERENCES "Address"("id"),
  "waitingForAssignment" BOOLEAN NOT NULL DEFAULT FALSE,
  "durationType" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "undone" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdById" TEXT NOT NULL REFERENCES "User"("id"),
  "approvedById" TEXT REFERENCES "User"("id"),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ChangeRequest" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "studentId" TEXT REFERENCES "Student"("id"),
  "trip" TEXT,
  "source" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "busNumber" TEXT,
  "companyNote" TEXT NOT NULL DEFAULT '',
  "payload" TEXT NOT NULL DEFAULT '{}',
  "createdById" TEXT NOT NULL REFERENCES "User"("id"),
  "reviewedById" TEXT REFERENCES "User"("id"),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id"),
  "studentId" TEXT REFERENCES "Student"("id"),
  "actorId" TEXT NOT NULL REFERENCES "User"("id"),
  "approvedById" TEXT REFERENCES "User"("id"),
  "action" TEXT NOT NULL,
  "trip" TEXT,
  "durationType" TEXT,
  "oldPlan" TEXT NOT NULL DEFAULT '{}',
  "newPlan" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Demo school, users, buses, and students
DO $$
DECLARE
  school_id TEXT := 'sch_riverside';
  coord_id TEXT := 'usr_coordinator';
  pw TEXT := '$2b$10$lpJbSy3aiKUiyt0YYNRDyO0Cg9jnSjy4rHVkArTlbLoHgu2xTuEWq';
  today TEXT := to_char((now() AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD');
  first_names TEXT[] := ARRAY[
    'Noah','Olivia','Liam','Emma','Ava','Sophia','Isabella','Mia','Lucas','Amelia',
    'Henry','Harper','Leo','Evelyn','Jack','Luna','Owen','Chloe','Samuel','Penelope',
    'Daniel','Layla','Matthew','Riley','Joseph','Zoey','David','Nora','Carter','Lily',
    'Wyatt','Eleanor','John','Hannah','Luke','Lillian','Gabriel','Addison','Anthony','Aubrey',
    'Isaac','Ellie','Grayson','Stella','Julian','Natalie','Levi','Zoe','Lincoln','Leah',
    'Jaxon','Hazel','Asher','Violet','Christopher','Aurora','Joshua','Savannah','Andrew','Audrey',
    'Theodore','Brooklyn','Caleb','Bella','Ryan','Claire','Nathan','Skylar','Isaiah','Lucy',
    'Thomas','Paisley','Charles','Everly','Eli','Anna','Aaron','Caroline','Connor','Nova',
    'Jeremiah','Genesis','Cameron','Aaliyah','Josiah','Kennedy','Adrian','Kinsley','Dominic','Allison',
    'Nolan','Maya','Christian','Sarah','Landon','Madelyn','Aiden','Adeline','Hunter','Alexa',
    'Jonathan','Ariana','Santiago','Elena','Axel','Gabriella','Easton','Naomi','Cooper','Alice',
    'Jerome','Ruby','Colton','Eva','Jose','Sadie','Roman','Quinn','James','Piper',
    'Robert','Serenity','Angel','Nevaeh','Ian','Cora','Jordan','Kaylee','Nicholas','Julia',
    'Ezra','Willow','Aaron','Ivy','Adam','Lydia','Jace','Clara','Xavier','Valentina',
    'Jose','Maria','Diego','Sofia','Fatima','Yusuf','Aisha','Hassan','Maryam','Omar',
    'Zainab','Ibrahim','Khadija','Bilal','Hana','Idris','Salma','Tariq','Noor','Samir'
  ];
  last_names TEXT[] := ARRAY[
    'Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez',
    'Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee',
    'Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker',
    'Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green',
    'Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Gomez',
    'Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart',
    'Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson',
    'Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson','Watson','Brooks','Chavez',
    'Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes','Price','Alvarez','Castillo',
    'Sanders','Patel','Myers','Long','Ross','Foster','Jimenez','Powell','Jenkins','Perry',
    'Russell','Sullivan','Bell','Coleman','Butler','Henderson','Barnes','Gonzales','Fisher','Vasquez',
    'Simmons','Romero','Jordan','Patterson','Alexander','Hamilton','Graham','Reynolds'
  ];
  streets TEXT[] := ARRAY[
    'Oak Street','Maple Avenue','Cedar Lane','Pine Road','Willow Drive','Birch Court','Elm Street',
    'Sunset Boulevard','River Road','Hillcrest Drive','Meadow Lane','Lakeview Avenue','Cherry Street',
    'Walnut Avenue','Spruce Court'
  ];
  rooms TEXT[] := ARRAY['cls_101','cls_102','cls_201','cls_202','cls_203','cls_301','cls_302','cls_303'];
  grades TEXT[] := ARRAY['K','1','2','3','3','4','5','5'];
  i INT;
  room_i INT;
  sid TEXT;
  addr_id TEXT;
  daycare_id TEXT;
  am_type TEXT;
  pm_type TEXT;
  am_bus TEXT;
  pm_bus TEXT;
  pm_dest TEXT;
  wait BOOLEAN;
  temp_pm BOOLEAN;
BEGIN
  INSERT INTO "School" ("id", "name", "timezone")
  VALUES (school_id, 'Riverside Elementary', 'America/Chicago');

  INSERT INTO "Classroom" ("id", "schoolId", "name", "grade") VALUES
    ('cls_101', school_id, 'Room 101', 'K'),
    ('cls_102', school_id, 'Room 102', '1'),
    ('cls_201', school_id, 'Room 201', '2'),
    ('cls_202', school_id, 'Room 202', '3'),
    ('cls_203', school_id, 'Room 203', '3'),
    ('cls_301', school_id, 'Room 301', '4'),
    ('cls_302', school_id, 'Room 302', '5'),
    ('cls_303', school_id, 'Room 303', '5');

  INSERT INTO "Teacher" ("id", "schoolId", "classroomId", "name", "email") VALUES
    ('tch_bennett', school_id, 'cls_101', 'Sarah Bennett', 'sbennett@riverside.edu'),
    ('tch_porter', school_id, 'cls_102', 'James Porter', 'jporter@riverside.edu'),
    ('tch_shah', school_id, 'cls_201', 'Priya Shah', 'pshah@riverside.edu'),
    ('tch_vasquez', school_id, 'cls_202', 'Elena Vasquez', 'evasquez@riverside.edu'),
    ('tch_brooks', school_id, 'cls_203', 'Michael Brooks', 'mbrooks@riverside.edu'),
    ('tch_cole', school_id, 'cls_301', 'Hannah Cole', 'hcole@riverside.edu'),
    ('tch_okonkwo', school_id, 'cls_302', 'David Okonkwo', 'dokonkwo@riverside.edu'),
    ('tch_lin', school_id, 'cls_303', 'Grace Lin', 'glin@riverside.edu');

  INSERT INTO "Address" ("id", "schoolId", "line1", "city", "state", "zip", "label") VALUES
    ('addr_sunshine', school_id, '410 Daycare Way', 'Springfield', 'IL', '62702', 'daycare'),
    ('addr_stars', school_id, '88 Little Stars Blvd', 'Springfield', 'IL', '62703', 'daycare');

  INSERT INTO "Daycare" ("id", "schoolId", "addressId", "name") VALUES
    ('day_sunshine', school_id, 'addr_sunshine', 'Sunshine Kids Academy'),
    ('day_stars', school_id, 'addr_stars', 'Little Stars Daycare');

  INSERT INTO "User" ("id", "schoolId", "email", "name", "passwordHash", "role", "teacherId") VALUES
    (coord_id, school_id, 'coordinator@riverside.edu', 'Maya Chen', pw, 'COORDINATOR', NULL),
    ('usr_admin', school_id, 'admin@riverside.edu', 'Dana Ruiz', pw, 'ADMINISTRATOR', NULL),
    ('usr_front', school_id, 'frontdesk@riverside.edu', 'Luis Ortega', pw, 'FRONT_DESK', NULL),
    ('usr_bus', school_id, 'dispatch@citytransit.example', 'City Transit Dispatch', pw, 'BUS_COMPANY', NULL),
    ('usr_bennett', school_id, 'sbennett@riverside.edu', 'Sarah Bennett', pw, 'TEACHER', 'tch_bennett'),
    ('usr_porter', school_id, 'jporter@riverside.edu', 'James Porter', pw, 'TEACHER', 'tch_porter'),
    ('usr_shah', school_id, 'pshah@riverside.edu', 'Priya Shah', pw, 'TEACHER', 'tch_shah'),
    ('usr_vasquez', school_id, 'evasquez@riverside.edu', 'Elena Vasquez', pw, 'TEACHER', 'tch_vasquez'),
    ('usr_brooks', school_id, 'mbrooks@riverside.edu', 'Michael Brooks', pw, 'TEACHER', 'tch_brooks'),
    ('usr_cole', school_id, 'hcole@riverside.edu', 'Hannah Cole', pw, 'TEACHER', 'tch_cole'),
    ('usr_okonkwo', school_id, 'dokonkwo@riverside.edu', 'David Okonkwo', pw, 'TEACHER', 'tch_okonkwo'),
    ('usr_lin', school_id, 'glin@riverside.edu', 'Grace Lin', pw, 'TEACHER', 'tch_lin');

  FOR i IN 1..6 LOOP
    INSERT INTO "BusRoute" ("id", "schoolId", "number", "name", "trip")
    VALUES ('bus_am_' || i, school_id, i::text, 'Route ' || i, 'AM');
    INSERT INTO "BusRoute" ("id", "schoolId", "number", "name", "trip")
    VALUES ('bus_pm_' || i, school_id, i::text, 'Route ' || i, 'PM');
  END LOOP;

  -- Featured students
  INSERT INTO "Address" ("id", "schoolId", "line1", "city", "state", "zip")
  VALUES ('addr_mohammed', school_id, '101 Oak Street', 'Springfield', 'IL', '62701');
  INSERT INTO "Student" ("id", "schoolId", "studentId", "firstName", "lastName", "grade", "classroomId", "parentName", "parentPhone", "homeAddressId", "daycareId", "notes")
  VALUES ('stu_mohammed', school_id, 'RIV-1001', 'Mohammed', 'Khalid', '4', 'cls_301', 'Yasmin Khalid', '217-555-0144', 'addr_mohammed', 'day_sunshine', 'Featured demo student');
  INSERT INTO "TransportationAssignment" ("id", "studentId", "trip", "type", "destination", "busRouteId", "daycareId", "updatedById")
  VALUES
    ('asg_mohammed_am', 'stu_mohammed', 'AM', 'BUS', 'HOME', 'bus_am_3', NULL, coord_id),
    ('asg_mohammed_pm', 'stu_mohammed', 'PM', 'BUS', 'DAYCARE', 'bus_pm_4', 'day_sunshine', coord_id);
  INSERT INTO "TemporaryChange" ("id", "studentId", "trip", "type", "destination", "durationType", "startDate", "endDate", "reason", "status", "createdById", "approvedById", "approvedAt")
  VALUES ('tmp_mohammed', 'stu_mohammed', 'PM', 'PARENT', 'HOME', 'TODAY', today, today, 'Parent requested pickup today', 'APPROVED', coord_id, coord_id, now());

  INSERT INTO "Address" ("id", "schoolId", "line1", "city", "state", "zip")
  VALUES ('addr_amina', school_id, '102 Maple Avenue', 'Springfield', 'IL', '62701');
  INSERT INTO "Student" ("id", "schoolId", "studentId", "firstName", "lastName", "grade", "classroomId", "parentName", "parentPhone", "homeAddressId")
  VALUES ('stu_amina', school_id, 'RIV-1002', 'Amina', 'Ali', '3', 'cls_202', 'Fatima Ali', '217-555-0190', 'addr_amina');
  INSERT INTO "TransportationAssignment" ("id", "studentId", "trip", "type", "destination", "updatedById")
  VALUES
    ('asg_amina_am', 'stu_amina', 'AM', 'PARENT', 'HOME', coord_id),
    ('asg_amina_pm', 'stu_amina', 'PM', 'PARENT', 'HOME', coord_id);

  INSERT INTO "Address" ("id", "schoolId", "line1", "city", "state", "zip")
  VALUES ('addr_ahmed', school_id, '103 Cedar Lane', 'Springfield', 'IL', '62701');
  INSERT INTO "Student" ("id", "schoolId", "studentId", "firstName", "lastName", "grade", "classroomId", "parentName", "parentPhone", "homeAddressId")
  VALUES ('stu_ahmed', school_id, 'RIV-1003', 'Ahmed', 'Omar', '2', 'cls_201', 'Layla Omar', '217-555-0118', 'addr_ahmed');
  INSERT INTO "TransportationAssignment" ("id", "studentId", "trip", "type", "destination", "busRouteId", "updatedById")
  VALUES
    ('asg_ahmed_am', 'stu_ahmed', 'AM', 'BUS', 'HOME', 'bus_am_2', coord_id),
    ('asg_ahmed_pm', 'stu_ahmed', 'PM', 'BUS', 'HOME', 'bus_pm_2', coord_id);
  INSERT INTO "TemporaryChange" ("id", "studentId", "trip", "type", "destination", "durationType", "startDate", "endDate", "reason", "status", "createdById", "approvedById", "approvedAt")
  VALUES ('tmp_ahmed', 'stu_ahmed', 'PM', 'PARENT', 'HOME', 'TODAY', today, today, 'Temporary parent pickup today', 'APPROVED', coord_id, coord_id, now());

  FOR i IN 0..161 LOOP
    room_i := (i % 8) + 1;
    sid := 'stu_' || i;
    addr_id := 'addr_' || i;
    wait := FALSE;
    temp_pm := FALSE;
    pm_dest := 'HOME';
    daycare_id := NULL;

    IF i % 11 = 0 THEN
      IF i % 2 = 0 THEN daycare_id := 'day_sunshine'; ELSE daycare_id := 'day_stars'; END IF;
    END IF;

    IF i < 3 THEN
      am_type := 'BUS'; pm_type := 'BUS';
      am_bus := ((i % 6) + 1)::text;
      pm_bus := NULL;
      wait := TRUE;
    ELSIF i < 36 THEN
      pm_type := 'PARENT'; pm_bus := NULL;
      IF i % 2 = 0 THEN
        am_type := 'PARENT'; am_bus := NULL;
      ELSE
        am_type := 'BUS'; am_bus := ((i % 6) + 1)::text;
      END IF;
    ELSE
      am_type := 'BUS'; pm_type := 'BUS';
      am_bus := (((i + 2) % 6) + 1)::text;
      pm_bus := ((i % 6) + 1)::text;
      IF daycare_id IS NOT NULL THEN pm_dest := 'DAYCARE'; END IF;
    END IF;

    IF i >= 40 AND i < 46 THEN
      temp_pm := TRUE;
    END IF;

    INSERT INTO "Address" ("id", "schoolId", "line1", "city", "state", "zip")
    VALUES (addr_id, school_id, (100 + i)::text || ' ' || streets[(i % 15) + 1], 'Springfield', 'IL', '6270' || ((i % 9) + 1)::text);

    INSERT INTO "Student" ("id", "schoolId", "studentId", "firstName", "lastName", "grade", "classroomId", "parentName", "parentPhone", "homeAddressId", "daycareId")
    VALUES (
      sid, school_id, 'RIV-' || (2000 + i)::text,
      first_names[(i % array_length(first_names, 1)) + 1],
      last_names[((i * 3 + 7) % array_length(last_names, 1)) + 1],
      grades[room_i], rooms[room_i],
      (ARRAY['Alex','Sam','Jordan','Taylor','Casey'])[(i % 5) + 1] || ' ' || last_names[((i * 3 + 7) % array_length(last_names, 1)) + 1],
      '217-555-' || lpad(((1000 + (i % 9000)))::text, 4, '0'),
      addr_id, daycare_id
    );

    INSERT INTO "TransportationAssignment" ("id", "studentId", "trip", "type", "destination", "busRouteId", "daycareId", "waitingForAssignment", "updatedById")
    VALUES (
      'asg_am_' || i, sid, 'AM', am_type, 'HOME',
      CASE WHEN am_type = 'BUS' AND am_bus IS NOT NULL THEN 'bus_am_' || am_bus END,
      NULL, FALSE, coord_id
    );

    INSERT INTO "TransportationAssignment" ("id", "studentId", "trip", "type", "destination", "busRouteId", "daycareId", "waitingForAssignment", "updatedById")
    VALUES (
      'asg_pm_' || i, sid, 'PM', pm_type, pm_dest,
      CASE WHEN pm_type = 'BUS' AND pm_bus IS NOT NULL THEN 'bus_pm_' || pm_bus END,
      CASE WHEN pm_dest = 'DAYCARE' THEN daycare_id END,
      wait, coord_id
    );

    IF temp_pm THEN
      INSERT INTO "TemporaryChange" ("id", "studentId", "trip", "type", "destination", "durationType", "startDate", "endDate", "reason", "status", "createdById", "approvedById", "approvedAt")
      VALUES ('tmp_' || i, sid, 'PM', 'PARENT', 'HOME', 'TODAY', today, today, 'Family requested a one-day pickup', 'APPROVED', coord_id, coord_id, now());
    END IF;
  END LOOP;

  INSERT INTO "ChangeRequest" ("id", "schoolId", "studentId", "trip", "source", "title", "details", "status", "createdById", "reviewedById", "reviewedAt")
  VALUES (
    'req_mohammed', school_id, 'stu_mohammed', 'PM', 'FRONT_DESK',
    'Parent called: Mohammed Khalid pickup today',
    'Yasmin Khalid requested parent pickup for this afternoon only.',
    'APPROVED', coord_id, coord_id, now()
  );

  INSERT INTO "ChangeRequest" ("id", "schoolId", "source", "title", "details", "status", "createdById")
  VALUES (
    'req_waiting', school_id, 'BUS_COMPANY',
    'Three new riders waiting for route assignment',
    'Please assign buses for students marked waiting. Proposed numbers must be approved by the coordinator.',
    'PENDING', coord_id
  );

  INSERT INTO "AuditLog" ("id", "schoolId", "studentId", "actorId", "approvedById", "action", "trip", "durationType", "oldPlan", "newPlan")
  VALUES (
    'aud_mohammed', school_id, 'stu_mohammed', coord_id, coord_id, 'CREATE_TEMPORARY', 'PM', 'TODAY',
    '{"trip":"PM","type":"BUS","destination":"DAYCARE","busNumber":"4","source":"PERMANENT"}',
    '{"trip":"PM","type":"PARENT","destination":"HOME","source":"TODAY"}'
  );
END $$;
