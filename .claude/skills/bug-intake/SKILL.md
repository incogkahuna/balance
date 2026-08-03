---
name: bug-intake
description: Work a batch of user-filed bug reports and feature requests to completion — triage, fix, verify, commit, deploy, report back. Use this whenever the user pastes more than one report, a feedback-board dump, a numbered bug list, or reports in the `### [Bug] / [Feature idea] / [Note]` format with "Reported by … · Status:" lines, and also when they say things like "here are reports from usage", "work through these", "fix what you can and ask about the rest", or drop a wall of complaints from testers. Trigger it even when they don't use the word "bug" — a pasted list of user complaints about an app is this workflow.
---

# Bug intake

A batch of user reports is not a to-do list. It's raw signal from someone who
was interrupted mid-task, often dictated by voice, frequently describing
something that was already fixed, sometimes describing infrastructure rather
than code. The work is turning that into shipped fixes without wasting the
reporter's time or your own.

The failure modes this exists to prevent, in order of how expensive they are:

1. **Rebuilding what already ships.** In a real 36-item batch, a third were
   already done. Rebuilding them burns hours and destroys trust.
2. **Code-diving an infrastructure problem.** "Wall didn't save" was an unrun
   SQL migration. "Mic is broken" was an undeployed function. No amount of
   reading React fixes either.
3. **Guessing at an ambiguous report** and building the wrong thing.
4. **Claiming something works when you couldn't actually test it.**

## The shape of the work

Triage the whole batch before fixing anything → fix what you're confident
about → verify → commit per fix → deploy → report back grouped, with every
question batched at the end.

Do the triage pass in full first. It's tempting to start fixing item 1
immediately, but the triage is what tells you that items 4, 9, and 22 are the
same bug and item 7 shipped last week.

---

## Step 1 — Triage the whole batch

Read every report before touching code. For each, decide which bucket it's in.

| Bucket | Signal | What you do |
|---|---|---|
| **Already shipped** | Matches a recent commit or existing code | Verify it's really live, then say so — don't rebuild |
| **Infrastructure** | "didn't save", "server error", feature silently does nothing | Check migrations / deploys / env vars before reading app code |
| **Clear bug** | Describes wrong behavior in a locatable place | Fix it |
| **Clear feature** | Scope is unambiguous | Build it |
| **Needs scoping** | You can't tell *what* or *where* | Ask — batched with the others |
| **Needs an artifact** | References a screenshot/file you weren't given | Ask for it; don't guess from the title |

### Check what already ships — do this first

This is the highest-value five minutes in the whole workflow.

```bash
git log --oneline -40
```

Then grep for the feature nouns in the reports. A report saying "we need X" and
a commit saying "feat: X" is the single most common pattern in real batches,
because reports pile up faster than they get triaged and the reporter is
describing a version of the app that's weeks old.

Two things to be careful about:

- **Shipped ≠ working.** A commit exists, but the SQL it needs was never run,
  or the reporter is on a cached bundle. Verify before declaring victory.
- **Shipped-but-undiscoverable is a real bug.** "There's no way to generate a
  debrief" turned out to mean the button existed and was labelled "Generate
  Document" — the submit action was hidden behind a name nobody would guess.
  When someone can't find a feature that exists, the finding is a naming or
  placement bug, not a non-issue.

### Check infrastructure early

Reports that describe a feature doing *nothing* — no error, no result — are
usually not code. Before reading a single component, check the plumbing:
migrations run, functions deployed, env vars set, third-party app configured.
See `references/balance-context.md` for the concrete commands in this repo.

Getting this wrong is expensive in both directions: you burn an hour reading
correct code, and the user keeps hitting the bug because you "fixed" something
that wasn't broken.

---

## Step 2 — Read reports charitably

These are usually dictated on a phone between other tasks. Expect typos, run-on
sentences, missing punctuation, and words the dictation software mangled
("twirl down" = accordion, "non seminal" = not meaningful, "sdubmit" = submit,
"chanel" = channel). Read for intent. Never quote a typo back or make the
person feel sloppy — they took the time to report it.

**The "Where / expected" line and any attached screenshot are ground truth for
location.** If the title says one thing and the Where line says another, the
Where line wins — it was written while looking at the screen.

**Reporters describe symptoms, not causes, and their theory is often wrong.**
Someone reporting "the dropdown falls apart on web" had diagnosed a rendering
bug; the cause was a transparent `<select>` making the native popup inherit the
page background. Read the actual code before accepting the reporter's model of
what's wrong — but take the *symptom* completely seriously.

**Look for duplicate reports of one underlying issue.** Several differently-
worded reports frequently share a root cause. Fixing the root once and saying
so is better than three separate patches.

---

## Step 3 — Fix, with a confidence gate

**If you're less than ~75% sure you understand the report or have found the
right code, don't fix it — add it to the questions list.** This threshold
exists because a confident wrong fix is worse than a question: it burns the
user's review time, pollutes the diff, and has to be undone.

When you do fix:

- **Find the root cause.** The symptom is where the user noticed it, rarely
  where the bug lives. A mobile keyboard covering an input turned out to be an
  overlay pinned to the *layout* viewport instead of the visual one — no amount
  of adjusting the input would have fixed it.
- **Check whether the same bug exists elsewhere.** A camera-only file picker
  was reported on one screen and present on four.
- **Prefer the fix that can't regress.** When two designs both satisfy the
  report, pick the one where a future mistake is impossible rather than merely
  unlikely, and say why in the commit.
- **Watch for bugs you introduce while fixing.** Hardcoding white text over a
  panel that is dark in one theme and near-white in the other trades one
  legibility bug for another. Check both states.

If a fix requires a schema change, the user's ability to apply it is part of
the work — write it idempotent and hand it over as one paste.

---

## Step 4 — Verify honestly

Try to exercise the change the way the user would. Build, run the app, click
the thing.

When you genuinely can't — no session, no credentials, environment limits —
**unit-test the pure logic instead and say plainly what you did and didn't
verify.** Extract the comparator, the matcher, the derivation into a scratch
script and run it against real cases including the edge ones.

```bash
node /tmp/check.mjs   # or python, whatever fits
```

This is not a lesser outcome; a sort comparator proven against dirty dates and
missing fields is better evidence than one click in a browser. What's not
acceptable is implying you clicked through something you couldn't reach.

Both the commit message and the reply to the user should carry that
distinction. "Verified in dev: X" and "logic unit-tested; the on-screen path
needs a real session" are both fine. "Fixed" with nothing behind it is not.

---

## Step 5 — Commit per fix

One logical fix per commit, with the report's own words in the body so the
reasoning survives.

```
fix(cards): readable stats over artwork; dropdowns stop falling apart on desktop

Two issues from Danny's screenshot of a card with a full-bleed photo.

LEGIBILITY — the cheat-sheet block sat directly on the image with
label-grey titles. It now gets its own near-opaque panel [...]
Deliberately NOT hardcoded white: that panel is near-black in dark mode
but near-WHITE in light mode, so white titles would have disappeared for
light-theme users.

DROPDOWNS — the compact selects were bg-transparent with unstyled
<option>s. A see-through select makes the native desktop popup inherit
the page background, which is why the open list rendered pale-on-pale.

Verified by probing computed styles in both themes.
```

What makes this good: it names the reported symptom, states the *actual* cause,
records the judgment call and why the obvious alternative was rejected, and is
honest about the verification method.

---

## Step 6 — Deploy and confirm it's really live

Push, then confirm the deploy actually landed rather than assuming. A fix the
user can't see is not a fix, and "it's pushed" has burned this workflow before
when the push itself was blocked.

If deployment or a required secret is outside your permissions, say so plainly
and give the exact command — don't leave it implied at the bottom of a long
message where it will be missed.

---

## Step 7 — Report back

Lead with the triage, because the most valuable thing you can tell someone with
a 36-item list is that 12 of them are already done.

```markdown
## Triage of the N reports

**✅ Already shipped** — [list]. Two need action from you: [what].

**🔧 Fixed now** (table: report → what was wrong → what changed)

**❓ Questions** (batched, numbered, each with why you're asking and your best guess)
```

Rules that make this land:

- **Batch every question.** Drip-feeding one at a time is the fastest way to
  lose someone who is multitasking.
- **For each question, offer your best guess** so they can answer "yes" instead
  of composing a spec.
- **Separate what's on them from what's on you.** SQL to paste, apps to
  configure, screenshots to send — grouped, exact, copy-pasteable.
- **Say what you couldn't verify.** Every time.
- **Don't bury a blocker in prose.** If something can't ship without them, it
  goes near the top with the command they need.

If part of the batch is blocked, finish everything else and state plainly what
you left out and why. Scaling the batch down is the user's call, not yours.

---

## Project specifics

Read `references/balance-context.md` when working in the Balance repo — it has
the infrastructure checks (schema audit, edge-function status), the dev-
environment limitations that determine what can actually be verified, the
deploy-confirmation loop, and the conventions the user expects for handed-over
SQL.
