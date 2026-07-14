# Tasteology & Co · CRM

A simple, modern CRM for Tasteology & Co: track leads, convert won leads into
clients, manage payment milestones, assign freelancers, and see the full
accounting picture — all timestamped.

Built with **Next.js (App Router) + React + Tailwind CSS** and **Supabase**
(Postgres) for storage.

## Features

- **Dashboard** — key numbers, pipeline breakdown, and a timestamped activity feed.
- **Leads** — add manually or mark as coming from Calendly. Fields: full name,
  email, phone, project brief, Zoom link. Status flow: `New → Booked → Quoted → Won`.
- **Win → Client** — setting a lead to *Won* signs the project, moves it to
  Clients, and lets you enter the total amount plus three payment milestones.
- **Clients & payments** — mark each of the 3 payments as paid (records date + time),
  edit amounts, assign a freelancer and their fee, and mark the freelancer paid.
- **Freelancers** — create freelancers and see projects/owed/paid per person.
- **Accounting** — total contracted, received, outstanding, freelancer cost/paid/owed,
  net profit and projected profit, plus a per-project breakdown.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In the dashboard, open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**. This creates
   the `leads`, `clients`, `payments`, and `freelancers` tables.
3. Open **Project Settings → API** and copy the **Project URL** and the
   **anon public** key.

### 3. Add environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- This is an internal tool without login. The database policies allow the anon
  key full read/write access. If you later want to lock it down, add Supabase
  Auth and tighten the row-level-security policies in `supabase/schema.sql`.
- All money is shown in **USD**. To change the currency, edit `src/lib/format.ts`.
- Calendly leads are tracked with a manual "source" field for now. Full
  auto-import via Calendly webhooks can be added later.
