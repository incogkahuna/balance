import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'

export function TopBar({ title }) {
  const { currentUser, logout } = useApp()
  const navigate = useNavigate()

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-orbital-bg/90 backdrop-blur border-b border-orbital-border">
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-bold text-orbital-text">Balance</span>
        <span className="text-xs text-orbital-subtle">by Orbital</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="p-1.5 rounded-lg hover:bg-orbital-muted text-orbital-subtle hover:text-red-400 transition-colors"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white text-sm"
          style={{ backgroundColor: currentUser?.color }}
        >
          {currentUser?.avatar}
        </div>
      </div>
    </header>
  )
}
