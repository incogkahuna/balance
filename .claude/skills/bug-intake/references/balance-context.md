# Balance — project context for bug intake

Concrete commands and constraints for this repo. Read when triaging or
verifying reports against Balance.

**Contents**
- Where reports come from
- Infrastructure checks (run these before code-diving)
- What can and can't be verified in dev
- Deploy and confirm
- SQL conventions
- Codebase map

---

## Where reports come from

Danny exports them from the in-app **Bugs & Ideas** board (`/feedback`) using
"Copy all as prompt". The format:

```
### [Bug] short title
*Reported by Danny Horgan · Jul 24, 2026 · Status: New*

**Where / expected:** the screen or flow

Free-text body, usually voice-dictated.

> 📎 A screenshot is attached to this report in the app.
```

Kinds are `[Bug]`, `[Feature idea]`, `[Note]` — but treat the *content* as
authoritative, not the label. Plenty of `[Note]`s are bugs and some `[Bug]`s
are feature requests.

Status values include `New`, `Acknowledged`, `In Progress`, `Revisit`,
`Shipped`, `Won't Fix`. **`In Progress` very often means already shipped** —
statuses lag reality. Check the code, don't trust the badge.

The screenshot line means the image exists in the app but is *not* in the
pasted text. Ask for it rather than guessing from the title.

---

## Infrastructure checks — run before reading app code

Reports where a feature does *nothing* are usually plumbing.

### Is the schema actually applied?

`.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. A missing
column returns PostgREST error `42703`; an existing one returns `[]` (RLS hides
rows but the column check still happens).

```bash
set -a; . ./.env.local; set +a
check_col () {
  out=$(curl -s "$VITE_SUPABASE_URL/rest/v1/$1?select=$2&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY")
  echo "$out" | grep -q '42703' && echo "MISSING $1.$2" || echo "ok      $1.$2"
}
check_col productions card_image
check_col pipeline_quotes mode
```

Table existence: `200` = exists, `404` = missing.

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "$VITE_SUPABASE_URL/rest/v1/led_walls?select=id&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

**You cannot verify rows or constraints this way** — RLS hides them from the
anon key. Check constraints (e.g. whether a status enum accepts a new value)
and grant rows are invisible. Say so rather than guessing; hand over the
idempotent SQL and let the user's verify query answer it.

### Are the edge functions deployed?

`401` = deployed with its auth gate working. `404` = not deployed.

```bash
for fn in parse-intake transcribe slack-bot synthesize-debriefs; do
  curl -s -o /dev/null -w "$fn %{http_code}\n" -X POST \
    "$VITE_SUPABASE_URL/functions/v1/$fn" -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" -d '{}'
done
```

Deployed but returning `{"error":"Server not configured"}` means the function is
live but missing a secret — a different fix (`supabase secrets set …`) with no
redeploy needed.

Real examples this caught: dictation mics dead because `transcribe` was never
deployed; `@balance` never working because `slack-bot` was never deployed;
"add wall didn't save" because the `led_walls` migration hadn't been run.

---

## What can and can't be verified in dev

There is **no Supabase session** in dev — the `/login` bypass sets a
`currentUser` but no real auth. This shapes everything about verification.

| Area | Testable in dev? |
|---|---|
| **Pipeline** (deals, quotes, quote builder, PDF) | ✅ Yes — localStorage fallback. Use `Seed demo deals` on `/pipeline`. |
| **Backdrops, feedback items, anything localStorage-backed** | ✅ Yes |
| **Pure logic** (sorts, matchers, derivations, money math) | ✅ Yes — extract to a scratch script and run in node |
| **Productions and anything scoped to one** | ⚠️ Optimistic render only — RLS rejects the insert and the row **rolls back within ~1 second** |

For production-scoped UI you can sometimes catch the optimistic window with a
tight poll, but it is unreliable. Don't claim verification you didn't get:

```js
// create the production, then poll hard for the UI you need to see
const iv = setInterval(() => { /* look for the element, capture, clear */ }, 40)
setTimeout(() => clearInterval(iv), 4000)
```

Useful for admin-gated UI:

```js
localStorage.setItem('balance_dev_view_as', 'danny'); location.reload()
```

Start the dev server with the preview tool (`Balance (Vite)` in
`.claude/launch.json`), never a bare shell command.

---

## Deploy and confirm

Vercel auto-deploys on push to `master`. Confirm by watching the bundle hash
change rather than assuming:

```bash
baseline=$(curl -s https://balance-orbital.vercel.app | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1)
while true; do
  h=$(curl -s https://balance-orbital.vercel.app | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1)
  if [ -n "$h" ] && [ "$h" != "$baseline" ]; then echo "deployed: $h"; break; fi
  sleep 10
done
```

Guard against an empty response — a blank result must not be treated as a new
hash. Run it in the background and keep working.

**`git push` may be blocked by the permission layer.** If it is, say so
immediately with the command, near the top of the reply — a fix sitting
unpushed while the user believes it shipped is the worst outcome in this
workflow, and it has happened.

Supabase deploys are also blocked from agent sessions. Hand over:

```bash
supabase functions deploy <name> --project-ref ectyohuqgpnwivpjpuga
```

(`slack-bot` additionally needs `--no-verify-jwt` — Slack can't send a Supabase
auth header.)

---

## SQL conventions

**Everything handed to the user must be idempotent.** He pastes it into the
Supabase dashboard editor, where one `already exists` error rolls back the
entire block. This rule is absolute and was learned the hard way.

```sql
alter table public.x add column if not exists y jsonb;

do $$ begin
  alter table public.x add constraint x_y_check check (y in ('a','b'));
exception when duplicate_object then null; end $$;

insert into public.t (email, role) values ('a@b.com', 'admin')
on conflict (email) do update set role = excluded.role;
```

Put new blocks at the top of `docs/RUN-THIS-SQL.md` with a verify query that
returns one `true`/`false` row per item. Add the same statement to the relevant
file in `supabase/migrations/` so a fresh database gets it too.

**Client-side grace:** when shipping code that depends on a column the user
hasn't added yet, degrade instead of bricking. Postgres reports a missing column
as `42703`; PostgREST reports it as `PGRST204` ("Could not find the 'x' column
… in the schema cache") — handle both, retry the write without the field, and
log a pointer to the SQL.

---

## Codebase map

- **Data hub:** `src/context/AppContext.jsx` — all CRUD, optimistic updates with
  rollback, toasts, `resolveUserName`
- **Data layer:** `src/lib/data/*.ts` — row ↔ camelCase mapping at the boundary
- **Pipeline:** `src/features/pipeline/` — `PipelineContext.jsx`,
  `quoteMath.js`, `QuoteBuilderPage.jsx`, `DealDetailPage.jsx`
- **Productions:** `src/pages/ProductionsPage.jsx` (cards),
  `ProductionDetailPage.jsx` (tabs), `src/components/productions/ProductionForm.jsx`
- **Debriefs:** `src/features/debriefs/`
- **Shared UI:** `src/components/ui/Modal.jsx` (keyboard-safe, scroll-locked),
  `src/hooks/useKeyboardInset.js`
- **Edge functions:** `supabase/functions/`

**Hard rule:** never import `format` from `date-fns` in render code — use
`src/lib/safeFormat.js`. One unparseable date used to take down whole pages.
Prefer raw `YYYY-MM-DD` string comparison over parsing when sorting.
