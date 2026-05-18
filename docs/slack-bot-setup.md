# Slack bot — setup runbook

Get the @-mention → Coming Soon flow live in your Orbital Slack workspace.
About 15 minutes start to finish. Anything tagged 🚧 needs you in a
dashboard; everything else is already in the repo.

---

## 1. Create the Slack app

1. Go to https://api.slack.com/apps and click **Create New App** → **From scratch**.
2. App name: **Balance**. Workspace: **Orbital Studios** (or whichever workspace you want to install it into).
3. You'll land on the app's **Basic Information** page.

## 2. Add bot scopes

In the left sidebar: **OAuth & Permissions** → scroll to **Scopes** → **Bot Token Scopes** → click **Add an OAuth Scope** and add:

- `app_mentions:read` — required, lets the bot receive @-mentions
- `chat:write` — optional but recommended (lets you @-reply to the user from the bot later)

## 3. Install to workspace

Scroll up on the same page → click **Install to Workspace** → **Allow**.
After install you'll see:

- **Bot User OAuth Token** — starts with `xoxb-…`. Copy it. (Settings → Install App → Bot User OAuth Token)
- **Signing Secret** — under **Basic Information** → **App Credentials**. Copy it.

## 4. Set the edge function secrets

Run from the project root:

```bash
supabase login                                                # one-time
supabase link --project-ref ectyohuqgpnwivpjpuga              # one-time
supabase secrets set SLACK_SIGNING_SECRET=<paste-here>
supabase secrets set SLACK_BOT_TOKEN=<paste-here>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already populated by Supabase for every edge function — no need to set those.

## 5. Deploy the edge function

```bash
supabase functions deploy slack-bot --no-verify-jwt
```

The `--no-verify-jwt` flag is required: Slack hits this endpoint without a Supabase auth header, and we do our own auth via the Slack signing secret (line-by-line verification in `supabase/functions/slack-bot/index.ts`).

Once deployed, the public URL is:

```
https://ectyohuqgpnwivpjpuga.supabase.co/functions/v1/slack-bot
```

## 6. Subscribe to events

Back in the Slack app dashboard:

1. Left sidebar → **Event Subscriptions** → toggle **Enable Events** on.
2. **Request URL** — paste the edge function URL from step 5.
3. Slack sends a one-time `url_verification` probe and expects an answer within ~3 seconds. The edge function handles this automatically. You should see the URL turn ✅ green.
4. Expand **Subscribe to bot events** → click **Add Bot User Event** → add `app_mention`.
5. **Save Changes** at the bottom.

Slack will prompt you to **Reinstall** the app — do it.

## 7. Try it

1. In any channel where you want the bot active: type `/invite @Balance` (or use the channel settings → Integrations → Add apps).
2. Type a message: `@Balance email sync should support BCC too`
3. Within ~1 second, open https://balance-six-gamma.vercel.app/coming-soon and the item should be there with a magenta **SLACK · your-username · #channel** badge.

---

## Troubleshooting

- **Request URL stays red in Slack:** check `supabase functions logs slack-bot --follow` for the error. Most common: `SLACK_SIGNING_SECRET` not set or incorrect.
- **Bot doesn't respond in channel:** Slack requires the bot be a member of the channel. `/invite @Balance` first.
- **Items appear but with raw IDs (U02ABC, C03DEF) instead of names:** Slack only sends names for some event types. If you want pretty names everywhere, the edge function would need to call `users.info` and `conversations.info` after each event — out of scope for v1.
- **Want to delete an item via Slack?** Not implemented. Web UI only for now.

---

## Architecture note

The edge function uses the Supabase service role key to bypass RLS when writing
to `coming_soon_items`. This is intentional and safe — the function is the
only thing that can write `source = 'slack'` rows, and the signing-secret
check ensures only your real Slack workspace can trigger inserts. The web UI
still goes through the normal admin/supervisor RLS policy for manual entries.
