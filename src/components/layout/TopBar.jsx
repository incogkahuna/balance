import { NotificationBell } from './NotificationBell.jsx'
import { AccountMenu } from './AccountMenu.jsx'
import { OrbitalMark } from '../brand/OrbitalLogo.jsx'

export function TopBar() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-2"
      style={{
        height: 48,
        background: 'var(--orbital-sidebar-bg)',
        borderBottom: '1px solid var(--orbital-sidebar-border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Left — brand. Hidden on desktop because the Sidebar carries the
          lockup there. Mobile has no sidebar, so this is the brand's home. */}
      <div className="flex items-center gap-2.5 px-2 lg:hidden">
        <OrbitalMark size={18} />
        <span
          className="text-sm font-semibold text-orbital-text"
          style={{ letterSpacing: '0.22em', marginRight: '-0.22em' }}
        >
          BALANCE
        </span>
      </div>

      {/* Spacer on desktop so the user cluster stays right-aligned even
          with the brand label hidden. */}
      <div className="hidden lg:block" />

      {/* Right — notifications + the account menu (identity, theme,
          backdrop customization, sign out). */}
      <div className="flex items-center">
        <NotificationBell layout="compact" />
        <AccountMenu />
      </div>
    </header>
  )
}
