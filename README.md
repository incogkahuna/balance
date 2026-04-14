# Balance

Internal production management app built by **Danny Horgan** in partnership with **Orbital Studios**.

Purpose-built for the rhythm, language, and workflow of a virtual production studio — LED volume and mobile builds.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS (dark mode, mobile-first) |
| Routing | React Router v6 |
| Charts | Recharts |
| Date handling | date-fns |
| Icons | lucide-react |
| Persistence | localStorage (v1) → Supabase (planned) |
| Voice | Web Speech API → Whisper API (planned) |

---

## Running locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`

---

## User profiles (v1 — no real auth)

| Name | Role | Access |
|---|---|---|
| Mark | Admin | Full access + analytics |
| AJ | Admin | Full access + analytics |
| Danny | Supervisor | Productions, tasks, add-ons |
| Brian | Crew | Own assignments, add-ons |
| Wilder | Crew | Own assignments, add-ons |

---

## Features

### Productions
Create and manage every job — client, location, type, status, team, dates.
Statuses: `Incoming` → `Active` → `Wrap` → `Completed`

### Tasks (two-tier completion)
1. Assignee marks task **Reported Complete** (with optional note)
2. Admin/Supervisor **Verifies Complete** — creates accountability chain

### Schedule — Gantt Views
- **Team Gantt** — each person is a row, productions are bars across time
- **Stage Gantt** — each location/stage is a row
- Week and month views. Bars are clickable → opens production record.

### Instruction Packages
Attached to productions and tasks: PDF/image uploads, voice memos (recorded in-app with live transcription via Web Speech API).

### Add-ons & Expenses
Log equipment, duration, cost. Damage flag with photo upload. All attached to the production record — replaces the Slack message chain.

### Feedback & Debrief
Structured post-production record: expectations vs. reality, issues, extra charges, 5-star rating. Builds institutional memory over time.

### Analytics (Admin only)
- Productions per month
- Task completion rates by person
- Production status breakdown
- Most-used equipment
- Damage incident log

---

## Project structure

```
src/
  App.jsx                        # Root + routes
  context/AppContext.jsx          # Global state, all CRUD, localStorage
  data/
    models.js                    # Data shapes, constants, factory functions
    sampleData.js                # Seed data (4 productions, 5 tasks)
  hooks/useLocalStorage.js       # Persistence hook
  components/
    layout/                      # AppShell, Sidebar, MobileNav, TopBar
    ui/                          # Modal, Badge, Avatar, EmptyState, ConfirmDialog
    productions/ProductionForm
    tasks/TaskCard, TaskForm
    addons/AddonForm
    feedback/FeedbackForm
    instructions/InstructionPackage
  pages/
    LoginPage                    # Profile selector
    DashboardPage                # My tasks + active productions
    ProductionsPage              # Grid + filters
    ProductionDetailPage         # 5-tab detail view
    SchedulePage                 # Gantt charts
    AnalyticsPage                # Admin only
```

---

## Planned integrations

- **Supabase** — replace localStorage with real database + auth
- **Whisper API** — replace Web Speech API for voice memo transcription
- **Orbital internal tools** — API-ready data models for cross-system integration

---

## Commit format

```
[area] short description
```

Examples: `[gantt] fix bar overlap on weekly view` · `[tasks] add priority filter` · `[ui] mobile nav active state`

---

*Balance v1 — Built by Danny Horgan in partnership with Orbital Studios*
