import { format, parseISO } from 'date-fns'

// ─────────────────────────────────────────────────────────────────────────────
// Feedback → prompt export. Formats Bugs & Ideas reports into paste-ready
// prompts for a coding agent (Claude Code). One item = one self-contained
// task block; a batch gets a header that gives the agent app context and
// working instructions so the paste needs zero editing.
// ─────────────────────────────────────────────────────────────────────────────

const KIND_LABEL = { bug: 'Bug', idea: 'Feature idea', note: 'Note' }

function fmtDate(iso) {
  if (!iso) return ''
  try { return format(parseISO(iso), 'MMM d, yyyy') } catch { return iso }
}

// One report as a standalone markdown task block.
export function formatFeedbackPrompt(item) {
  const lines = []
  const kind = KIND_LABEL[item.kind] || 'Report'
  lines.push(`### [${kind}] ${item.title || '(Untitled)'}`)

  const meta = [
    item.submittedByName && `Reported by ${item.submittedByName}`,
    item.submittedAt && fmtDate(item.submittedAt),
    item.status && `Status: ${item.status}`,
  ].filter(Boolean).join(' · ')
  if (meta) lines.push(`*${meta}*`)

  if (item.context?.trim()) {
    lines.push('', `**Where / expected:** ${item.context.trim()}`)
  }
  if (item.description?.trim()) {
    lines.push('', item.description.trim())
  }
  if (item.screenshot) {
    lines.push('', '> 📎 A screenshot is attached to this report in the app. It is not included in this text prompt — if the change is visual and you need to see it, ask the user to paste the screenshot before proceeding.')
  }
  if (item.resolutionNote?.trim()) {
    lines.push('', `> Prior resolution note: ${item.resolutionNote.trim()}`)
  }
  return lines.join('\n')
}

// A batch of reports as one complete, paste-ready prompt.
export function formatFeedbackPromptBatch(items, { filterLabel = '' } = {}) {
  const header = [
    `The following ${items.length === 1 ? 'is a user-filed report' : `are ${items.length} user-filed reports`}${filterLabel ? ` (${filterLabel})` : ''} from Balance — Orbital Studios' production-management app (React 18 + Vite + Tailwind + Supabase, repo layout: pages in \`src/pages/\`, feature folders in \`src/features/\`, data layer in \`src/lib/data/\`, app hub in \`src/context/AppContext.jsx\`).`,
    '',
    'Work through them one at a time: find the relevant code, make the change, verify it in the running app, and commit.',
    '',
    '- **Bugs:** fix directly — they describe a wrong behavior to correct.',
    '- **Feature ideas:** if the scope is clear, build it. If it is ambiguous about *what* or *where*, do NOT guess — briefly confirm the intended scope with the user before building, then implement.',
    '- A "Where / expected" line or an attached screenshot (noted per item) is the ground truth for *where* in the app a change belongs — use it.',
    '',
    '---',
    '',
  ].join('\n')

  return header + items.map(formatFeedbackPrompt).join('\n\n---\n\n')
}

// Clipboard write with a fallback for non-secure contexts.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
