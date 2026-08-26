# Bus & Dismissal Tracker

Unified AM and PM student transportation for Riverside Elementary. This is not a GPS bus tracker — it keeps every student’s arrival plan and dismissal plan accurate, including today-only exceptions that expire automatically.

## Why one application

Every student has both an **AM plan** and a **PM dismissal plan**. Temporary changes sit on top of the permanent assignment. Priority is always:

1. Today-only change
2. Date-range change
3. Permanent assignment

Example: Mohammed Khalid permanently rides Bus 3 in the morning and Bus 4 to daycare after school. If a parent requests pickup today, teachers see **Parent pickup**. Tomorrow he returns to Bus 4 without anyone changing him back.

## First version

- Student import from Excel/CSV
- Permanent AM and PM assignments
- Today-only and date-range changes
- Coordinator dashboard
- Teacher classroom view
- Bus and parent-pickup lists
- Dated print/email lists
- Audit history
- Bus-company change report (email first; company login can propose a bus number, coordinator approves)

## Roles

| Role | Access |
| --- | --- |
| Transportation Coordinator | Full control |
| School Administrator | View everything and manage users |
| Teacher | View/print assigned classroom only |
| Front Desk | Record parent requests; coordinator approves |
| Bus Company | Limited transportation queue |

## Database and source

- App repository: [github.com/askar2022/ampmflow](https://github.com/askar2022/ampmflow)
- Database: [Supabase project iardxvlhuapmlmqqrtgr](https://iardxvlhuapmlmqqrtgr.supabase.co)

Copy `.env.example` to `.env` and paste the Postgres connection strings from **Supabase → Project Settings → Database**. Use the pooled URI for `DATABASE_URL` and the session/direct URI for `DIRECT_URL`.

## Run locally

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo password for every account: `Riverside!2026`

- `coordinator@riverside.edu`
- `admin@riverside.edu`
- `evasquez@riverside.edu` (teacher, Room 202)
- `frontdesk@riverside.edu`
- `dispatch@citytransit.example`

Optional email: set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `BUS_COMPANY_EMAIL` in `.env`.
