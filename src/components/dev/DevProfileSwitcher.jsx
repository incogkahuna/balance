import { useApp } from '../../context/AppContext.jsx'

const ROLE_BADGE = {
  admin: 'A',
  supervisor: 'S',
  crew: 'C',
}

/**
 * Dev-only profile impersonation control.
 *
 * Renders nothing in production builds. In dev, lets you swap the
 * `currentUser` between the five legacy team members so you can test
 * role-gated UI without signing in as different real Google accounts.
 */
export function DevProfileSwitcher() {
  if (!import.meta.env.DEV) return null

  const { users, currentUser, devViewAs, setDevViewAs } = useApp()

  const isImpersonating = Boolean(devViewAs)
  const realName = currentUser && !currentUser.isDevImpersonation
    ? currentUser.name
    : 'Real session'

  return (
    <div className="flex items-center gap-2">
      <span className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">
        DEV
      </span>
      <select
        value={devViewAs || ''}
        onChange={(e) => setDevViewAs(e.target.value || null)}
        className={`
          text-xs font-medium rounded-md px-2 py-1
          bg-orbital-surface border border-orbital-border
          text-orbital-text hover:border-blue-500/50
          focus:outline-none focus:border-blue-500
          ${isImpersonating ? 'border-yellow-500/50 text-yellow-300' : ''}
        `}
        title="Dev only — overrides currentUser for role-gated UI testing"
      >
        <option value="">Real session ({realName})</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            View as: {u.name} [{ROLE_BADGE[u.role]}]
          </option>
        ))}
      </select>
    </div>
  )
}
