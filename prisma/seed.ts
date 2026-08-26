import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FIRST = [
  "Noah", "Olivia", "Liam", "Emma", "Ava", "Sophia", "Isabella", "Mia",
  "Lucas", "Amelia", "Henry", "Harper", "Leo", "Evelyn", "Jack", "Luna",
  "Owen", "Chloe", "Samuel", "Penelope", "Daniel", "Layla", "Matthew", "Riley",
  "Joseph", "Zoey", "David", "Nora", "Carter", "Lily", "Wyatt", "Eleanor",
  "John", "Hannah", "Luke", "Lillian", "Gabriel", "Addison", "Anthony", "Aubrey",
  "Isaac", "Ellie", "Grayson", "Stella", "Julian", "Natalie", "Levi", "Zoe",
  "Lincoln", "Leah", "Jaxon", "Hazel", "Asher", "Violet", "Christopher", "Aurora",
  "Joshua", "Savannah", "Andrew", "Audrey", "Theodore", "Brooklyn", "Caleb", "Bella",
  "Ryan", "Claire", "Nathan", "Skylar", "Isaiah", "Lucy", "Thomas", "Paisley",
  "Charles", "Everly", "Eli", "Anna", "Aaron", "Caroline", "Connor", "Nova",
  "Jeremiah", "Genesis", "Cameron", "Aaliyah", "Josiah", "Kennedy", "Adrian", "Kinsley",
  "Dominic", "Allison", "Nolan", "Maya", "Christian", "Sarah", "Landon", "Madelyn",
  "Aiden", "Adeline", "Hunter", "Alexa", "Jonathan", "Ariana", "Santiago", "Elena",
  "Axel", "Gabriella", "Easton", "Naomi", "Cooper", "Alice", "Jerome", "Ruby",
  "Colton", "Eva", "Jose", "Sadie", "Roman", "Quinn", "James", "Piper",
  "Robert", "Serenity", "Angel", "Nevaeh", "Ian", "Cora", "Jordan", "Kaylee",
  "Nicholas", "Julia", "Ezra", "Willow", "Aaron", "Ivy", "Adam", "Lydia",
  "Jace", "Clara", "Xavier", "Valentina", "Jose", "Maria", "Diego", "Sofia",
  "Fatima", "Yusuf", "Aisha", "Hassan", "Maryam", "Omar", "Zainab", "Ibrahim",
  "Khadija", "Bilal", "Hana", "Idris", "Salma", "Tariq", "Noor", "Samir",
];

const LAST = [
  "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez",
  "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor",
  "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris",
  "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen",
  "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
  "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter",
  "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz",
  "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy", "Cook",
  "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey", "Reed",
  "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson", "Watson",
  "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz",
  "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long",
  "Ross", "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell", "Sullivan",
  "Bell", "Coleman", "Butler", "Henderson", "Barnes", "Gonzales", "Fisher", "Vasquez",
  "Simmons", "Romero", "Jordan", "Patterson", "Alexander", "Hamilton", "Graham", "Reynolds",
];

const STREETS = [
  "Oak Street", "Maple Avenue", "Cedar Lane", "Pine Road", "Willow Drive",
  "Birch Court", "Elm Street", "Sunset Boulevard", "River Road", "Hillcrest Drive",
  "Meadow Lane", "Lakeview Avenue", "Cherry Street", "Walnut Avenue", "Spruce Court",
];

function pick<T>(list: T[], i: number) {
  return list[i % list.length];
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.changeRequest.deleteMany();
  await prisma.temporaryChange.deleteMany();
  await prisma.transportationAssignment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.busRoute.deleteMany();
  await prisma.daycare.deleteMany();
  await prisma.address.deleteMany();
  await prisma.school.deleteMany();

  const school = await prisma.school.create({
    data: { name: "Riverside Elementary", timezone: "America/Chicago" },
  });

  const classrooms = await Promise.all(
    [
      { name: "Room 101", grade: "K", teacher: "Sarah Bennett", email: "sbennett@riverside.edu" },
      { name: "Room 102", grade: "1", teacher: "James Porter", email: "jporter@riverside.edu" },
      { name: "Room 201", grade: "2", teacher: "Priya Shah", email: "pshah@riverside.edu" },
      { name: "Room 202", grade: "3", teacher: "Elena Vasquez", email: "evasquez@riverside.edu" },
      { name: "Room 203", grade: "3", teacher: "Michael Brooks", email: "mbrooks@riverside.edu" },
      { name: "Room 301", grade: "4", teacher: "Hannah Cole", email: "hcole@riverside.edu" },
      { name: "Room 302", grade: "5", teacher: "David Okonkwo", email: "dokonkwo@riverside.edu" },
      { name: "Room 303", grade: "5", teacher: "Grace Lin", email: "glin@riverside.edu" },
    ].map(async (room) => {
      const classroom = await prisma.classroom.create({
        data: { schoolId: school.id, name: room.name, grade: room.grade },
      });
      const teacher = await prisma.teacher.create({
        data: {
          schoolId: school.id,
          classroomId: classroom.id,
          name: room.teacher,
          email: room.email,
        },
      });
      return { classroom, teacher, grade: room.grade };
    }),
  );

  const password = await bcrypt.hash("Riverside!2026", 10);

  const coordinator = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "coordinator@riverside.edu",
      name: "Maya Chen",
      role: "COORDINATOR",
      passwordHash: password,
    },
  });

  await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admin@riverside.edu",
      name: "Dana Ruiz",
      role: "ADMINISTRATOR",
      passwordHash: password,
    },
  });

  await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "frontdesk@riverside.edu",
      name: "Luis Ortega",
      role: "FRONT_DESK",
      passwordHash: password,
    },
  });

  await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "dispatch@citytransit.example",
      name: "City Transit Dispatch",
      role: "BUS_COMPANY",
      passwordHash: password,
    },
  });

  for (const room of classrooms) {
    await prisma.user.create({
      data: {
        schoolId: school.id,
        email: room.teacher.email,
        name: room.teacher.name,
        role: "TEACHER",
        teacherId: room.teacher.id,
        passwordHash: password,
      },
    });
  }

  const busNumbers = ["1", "2", "3", "4", "5", "6"];
  const routes: Awaited<ReturnType<typeof prisma.busRoute.create>>[] = [];
  for (const number of busNumbers) {
    for (const trip of ["AM", "PM"] as const) {
      routes.push(
        await prisma.busRoute.create({
          data: {
            schoolId: school.id,
            number,
            trip,
            name: `Route ${number}`,
            loadingLocation: "Bus loading area",
          },
        }),
      );
    }
  }
  const route = (number: string, trip: "AM" | "PM") =>
    routes.find((r) => r.number === number && r.trip === trip)!;

  const sunshineAddr = await prisma.address.create({
    data: {
      schoolId: school.id,
      line1: "410 Daycare Way",
      city: "Springfield",
      state: "IL",
      zip: "62702",
      label: "daycare",
    },
  });
  const starsAddr = await prisma.address.create({
    data: {
      schoolId: school.id,
      line1: "88 Little Stars Blvd",
      city: "Springfield",
      state: "IL",
      zip: "62703",
      label: "daycare",
    },
  });
  const sunshine = await prisma.daycare.create({
    data: { schoolId: school.id, name: "Sunshine Kids Academy", addressId: sunshineAddr.id },
  });
  const stars = await prisma.daycare.create({
    data: { schoolId: school.id, name: "Little Stars Daycare", addressId: starsAddr.id },
  });

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  type Spec = {
    first: string;
    last: string;
    id: string;
    grade: string;
    room: number;
    parent: string;
    phone: string;
    daycare?: "sunshine" | "stars";
    am: { type: "BUS" | "PARENT"; bus?: string; dest?: "HOME" | "DAYCARE"; wait?: boolean };
    pm: { type: "BUS" | "PARENT"; bus?: string; dest?: "HOME" | "DAYCARE"; wait?: boolean };
    tempPm?: { type: "BUS" | "PARENT"; bus?: string; dest?: "HOME" | "DAYCARE"; reason: string };
  };

  const featured: Spec[] = [
    {
      first: "Mohammed",
      last: "Khalid",
      id: "RIV-1001",
      grade: "4",
      room: 5,
      parent: "Yasmin Khalid",
      phone: "217-555-0144",
      daycare: "sunshine",
      am: { type: "BUS", bus: "3", dest: "HOME" },
      pm: { type: "BUS", bus: "4", dest: "DAYCARE" },
      tempPm: {
        type: "PARENT",
        dest: "HOME",
        reason: "Parent requested pickup today",
      },
    },
    {
      first: "Amina",
      last: "Ali",
      id: "RIV-1002",
      grade: "3",
      room: 3,
      parent: "Fatima Ali",
      phone: "217-555-0190",
      am: { type: "PARENT", dest: "HOME" },
      pm: { type: "PARENT", dest: "HOME" },
    },
    {
      first: "Ahmed",
      last: "Omar",
      id: "RIV-1003",
      grade: "2",
      room: 2,
      parent: "Layla Omar",
      phone: "217-555-0118",
      am: { type: "BUS", bus: "2", dest: "HOME" },
      pm: { type: "BUS", bus: "2", dest: "HOME" },
      tempPm: {
        type: "PARENT",
        dest: "HOME",
        reason: "Temporary parent pickup today",
      },
    },
  ];

  const generated: Spec[] = [];
  // Permanent mix before today's exceptions:
  // 128 bus, 34 parent, 3 missing  => after 8 bus->pickup: 120 / 42 / 3
  for (let i = 0; i < 162; i++) {
    const first = pick(FIRST, i);
    const last = pick(LAST, i * 3 + 7);
    const room = i % classrooms.length;
    const useDaycare = i % 11 === 0;
    let pm: Spec["pm"];
    let am: Spec["am"];
    if (i < 3) {
      pm = { type: "BUS", wait: true, dest: "HOME" };
      am = { type: "BUS", bus: String((i % 6) + 1), dest: "HOME" };
    } else if (i < 36) {
      pm = { type: "PARENT", dest: "HOME" };
      am = i % 2 === 0 ? { type: "PARENT", dest: "HOME" } : { type: "BUS", bus: String((i % 6) + 1), dest: "HOME" };
    } else {
      const bus = String((i % 6) + 1);
      pm = {
        type: "BUS",
        bus,
        dest: useDaycare ? "DAYCARE" : "HOME",
      };
      am = { type: "BUS", bus: String(((i + 2) % 6) + 1), dest: "HOME" };
    }
    generated.push({
      first,
      last,
      id: `RIV-${2000 + i}`,
      grade: classrooms[room].grade,
      room,
      parent: `${pick(["Alex", "Sam", "Jordan", "Taylor", "Casey"], i)} ${last}`,
      phone: `217-555-${String(1000 + (i % 9000)).padStart(4, "0")}`,
      daycare: useDaycare ? (i % 2 === 0 ? "sunshine" : "stars") : undefined,
      am,
      pm,
    });
  }

  // 6 additional today-only bus -> parent (plus Mohammed + Ahmed = 8)
  for (let i = 40; i < 46; i++) {
    generated[i].tempPm = {
      type: "PARENT",
      dest: "HOME",
      reason: "Family requested a one-day pickup",
    };
  }

  const all = [...featured, ...generated];
  const usedNames = new Set<string>();

  for (const spec of all) {
    let first = spec.first;
    let last = spec.last;
    let key = `${first} ${last}`;
    let n = 2;
    while (usedNames.has(key)) {
      first = `${spec.first}`;
      last = `${spec.last} ${n}`;
      key = `${first} ${last}`;
      n += 1;
    }
    usedNames.add(key);

    const room = classrooms[spec.room];
    const home = await prisma.address.create({
      data: {
        schoolId: school.id,
        line1: `${100 + usedNames.size} ${pick(STREETS, usedNames.size)}`,
        city: "Springfield",
        state: "IL",
        zip: `6270${(usedNames.size % 9) + 1}`,
        label: "home",
      },
    });

    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        studentId: spec.id,
        firstName: first,
        lastName: last,
        grade: spec.grade,
        classroomId: room.classroom.id,
        parentName: spec.parent,
        parentPhone: spec.phone,
        homeAddressId: home.id,
        daycareId:
          spec.daycare === "sunshine"
            ? sunshine.id
            : spec.daycare === "stars"
              ? stars.id
              : undefined,
        notes: spec.id.startsWith("RIV-100") ? "Featured demo student" : "",
      },
    });

    for (const trip of ["AM", "PM"] as const) {
      const plan = trip === "AM" ? spec.am : spec.pm;
      const dest = plan.dest || "HOME";
      await prisma.transportationAssignment.create({
        data: {
          studentId: student.id,
          trip,
          type: plan.type,
          destination: dest,
          busRouteId:
            plan.type === "BUS" && plan.bus ? route(plan.bus, trip).id : undefined,
          daycareId: dest === "DAYCARE" ? student.daycareId : undefined,
          waitingForAssignment: Boolean(plan.wait),
          notes: "",
          updatedById: coordinator.id,
        },
      });
    }

    if (spec.tempPm) {
      await prisma.temporaryChange.create({
        data: {
          studentId: student.id,
          trip: "PM",
          type: spec.tempPm.type,
          destination: spec.tempPm.dest || "HOME",
          busRouteId:
            spec.tempPm.type === "BUS" && spec.tempPm.bus
              ? route(spec.tempPm.bus, "PM").id
              : undefined,
          durationType: "TODAY",
          startDate: todayKey,
          endDate: todayKey,
          reason: spec.tempPm.reason,
          status: "APPROVED",
          createdById: coordinator.id,
          approvedById: coordinator.id,
          approvedAt: new Date(),
        },
      });
    }
  }

  const mohammed = await prisma.student.findUnique({
    where: { schoolId_studentId: { schoolId: school.id, studentId: "RIV-1001" } },
  });

  await prisma.changeRequest.create({
    data: {
      schoolId: school.id,
      studentId: mohammed?.id,
      trip: "PM",
      source: "FRONT_DESK",
      title: "Parent called: Mohammed Khalid pickup today",
      details: "Yasmin Khalid requested parent pickup for this afternoon only.",
      status: "APPROVED",
      createdById: coordinator.id,
      reviewedById: coordinator.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.changeRequest.create({
    data: {
      schoolId: school.id,
      source: "BUS_COMPANY",
      title: "Three new riders waiting for route assignment",
      details: "Please assign buses for students marked waiting. Proposed numbers must be approved by the coordinator.",
      status: "PENDING",
      createdById: coordinator.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      studentId: mohammed?.id,
      actorId: coordinator.id,
      approvedById: coordinator.id,
      action: "CREATE_TEMPORARY",
      trip: "PM",
      durationType: "TODAY",
      oldPlan: JSON.stringify({
        trip: "PM",
        type: "BUS",
        destination: "DAYCARE",
        busNumber: "4",
        source: "PERMANENT",
      }),
      newPlan: JSON.stringify({
        trip: "PM",
        type: "PARENT",
        destination: "HOME",
        source: "TODAY",
      }),
    },
  });

  console.log("Seeded Riverside Elementary");
  console.log("Login: coordinator@riverside.edu / Riverside!2026");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
