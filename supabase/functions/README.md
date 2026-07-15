# Balance Edge Functions

Server-side functions that proxy from the authenticated browser app to
third-party APIs. Lives here because:

- API keys never ship to the browser bundle.
- Auth check ensures only signed-in studio users hit paid APIs.

## Functions

| Name           | Purpose                                                      | Required secrets    |
|----------------|--------------------------------------------------------------|---------------------|
| `transcribe`   | Audio blob → OpenAI Whisper → transcript text                | `OPENAI_API_KEY`    |
| `parse-intake` | Intake text + screenshots → Claude (vision) → structured production draft. Powers the intake wizard's Tier 2 parse and the Production Bible "Scan with AI" | `ANTHROPIC_API_KEY` |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by
Supabase Edge.

---

## First-time setup

```bash
# Log the CLI in (one-time, opens a browser).
supabase login

# Link this repo to your Supabase project.
supabase link --project-ref ectyohuqgpnwivpjpuga
```

## Set secrets (production)

```bash
# Whisper key
supabase secrets set OPENAI_API_KEY=sk-...

# Verify
supabase secrets list
```

Don't commit any value to this repo — the CLI stores them on Supabase.

## Deploy

```bash
# Deploy a single function
supabase functions deploy transcribe

# Or all functions
supabase functions deploy
```

After a deploy, the function is reachable at:
`https://<project-ref>.supabase.co/functions/v1/<name>`

The browser app calls them through `supabase.functions.invoke('<name>', ...)`,
which handles auth, base URL, and CORS automatically.

## Local development

```bash
# Create supabase/.env.local with your keys (gitignored)
echo "OPENAI_API_KEY=sk-..." > supabase/.env.local

# Run a single function locally with hot-reload
supabase functions serve transcribe --env-file ./supabase/.env.local
```

The browser app's `supabase.functions.invoke` will hit
`http://127.0.0.1:54321/functions/v1/<name>` when running against the
local Supabase stack (`supabase start`). For dev against the deployed
Supabase project, deploy the function — there's no `localhost` proxy when
the client is talking to a remote project.

## Troubleshooting

- **`Not authenticated`** — caller is missing a Supabase session JWT. The
  client wraps `supabase.functions.invoke`, which attaches it; check that
  the user is actually signed in before calling.
- **`Server not configured`** — secret missing on the Supabase side. Run
  `supabase secrets list` and re-set whatever's blank.
- **`Whisper error (4xx)`** — usually a malformed audio blob. Whisper
  expects: webm/mp4/mp3/m4a/wav/ogg, ≤ 25 MB, non-empty.
- **150s Edge Function timeout** — long recordings hit it on free tier.
  Recordings ≤ 3 minutes are safe; we cap recording duration in the UI
  at 180s for this reason.
