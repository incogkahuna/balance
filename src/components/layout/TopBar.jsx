import { useNavigate } from 'react-router-dom'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { NotificationBell } from './NotificationBell.jsx'

const ROLE_LABEL = {
  admin:      'Admin',
  supervisor: 'Supervisor',
  crew:       'Crew',
}

export function TopBar() {
  const { currentUser, logout } = useApp()
  const { theme, toggleTheme }  = useTheme()
  const navigate = useNavigate()

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
      {/* Left — app name. Hidden on desktop because the Sidebar already
          shows "Balance / Orbital" in its header. Mobile has no sidebar
          so this is the only place the brand renders there. */}
      <div className="flex items-center gap-3 px-2 lg:hidden">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-indicator-pulse" />
        <span className="text-sm font-semibold text-orbital-text">Balance</span>
        <span className="text-xs text-orbital-subtle">/ Orbital</span>
      </div>

      {/* Spacer on desktop so the user cluster stays right-aligned even
          with the brand label hidden. */}
      <div className="hidden lg:block" />

      {/* Right — notifications + theme toggle + sign-out + user avatar.
          Per Wilder's feedback: user profile + settings live top-right
          on every viewport now, not buried in the bottom of the sidebar. */}
      <div className="flex items-center">
        <NotificationBell layout="compact" />
        <button
          onClick={toggleTheme}
          className="w-11 h-11 flex items-center justify-center text-orbital-subtle hover:text-orbital-text transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="w-11 h-11 flex items-center justify-center text-orbital-subtle hover:text-orbital-text transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white ml-1 mr-2"
          style={{ backgroundColor: currentUser?.color }}
          title={`${currentUser?.name} · ${ROLE_LABEL[currentUser?.role] || 'Crew'}`}
        >
          {currentUser?.avatar}
        </div>
      </div>
    </header>
  )
}
