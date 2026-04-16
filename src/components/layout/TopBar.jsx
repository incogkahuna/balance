import { useNavigate } from 'react-router-dom'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'

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
      className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4"
      style={{
        height: 44,
        background: 'var(--orbital-sidebar-bg)',
        borderBottom: '1px solid var(--orbital-sidebar-border)',
      }}
    >
      {/* Left — app name */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-indicator-pulse" />
        <span className="text-sm font-semibold text-orbital-text">Balance</span>
        <span className="text-xs text-orbital-subtle">/ Orbital</span>
      </div>

      {/* Right — theme toggle + user + logout */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-1.5 text-orbital-subtle hover:text-orbital-text transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <span className="text-xs text-orbital-subtle">
          {ROLE_LABEL[currentUser?.role] || 'Crew'}
        </span>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="p-1.5 text-orbital-subtle hover:text-orbital-text transition-colors"
          title="Sign out"
        >
          <LogOut size={14} />
        </button>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
          style={{ backgroundColor: currentUser?.color }}
        >
          {currentUser?.avatar}
        </div>
      </div>
    </header>
  )
}
