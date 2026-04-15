import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'

const ROLE_META = {
  admin:      { label: 'ADMIN',  color: '#38bdf8' },
  supervisor: { label: 'SUPVR',  color: '#fbbf24' },
  crew:       { label: 'CREW',   color: '#4ade80' },
}

export function TopBar() {
  const { currentUser, logout } = useApp()
  const navigate = useNavigate()
  const role = ROLE_META[currentUser?.role] || ROLE_META.crew

  return (
    <header
      className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4"
      style={{
        height: 52,
        background: 'linear-gradient(180deg, #070f1b 0%, #050c16 100%)',
        borderBottom: '1px solid #112235',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Left — logo + status */}
      <div className="flex items-center gap-3">
        {/* System status dot */}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-indicator-pulse" />
        </div>

        <div>
          <span className="text-sm font-bold tracking-tight text-orbital-text"
            style={{ letterSpacing: '-0.01em' }}>
            BALANCE
          </span>
          <span className="font-telemetry text-[8px] tracking-[0.2em] ml-2"
            style={{ color: '#3f5a75' }}>
            ORBITAL
          </span>
        </div>
      </div>

      {/* Right — user + actions */}
      <div className="flex items-center gap-2">
        {/* Role badge */}
        <span className="font-telemetry text-[9px] tracking-[0.15em] px-2 py-1"
          style={{
            color: role.color,
            background: `${role.color}18`,
            border: `1px solid ${role.color}35`,
          }}>
          {role.label}
        </span>

        <button
          onClick={() => { logout(); navigate('/login') }}
          className="p-2 transition-colors"
          style={{ color: '#7090a8', border: '1px solid transparent' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#ef4444'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#7090a8'
            e.currentTarget.style.borderColor = 'transparent'
          }}
        >
          <LogOut size={16} />
        </button>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
          style={{
            backgroundColor: currentUser?.color,
            boxShadow: `0 0 0 1px ${currentUser?.color}55, 0 0 8px ${currentUser?.color}30`,
          }}
        >
          {currentUser?.avatar}
        </div>
      </div>
    </header>
  )
}
