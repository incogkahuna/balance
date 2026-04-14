import { useNavigate, Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { USERS, ROLES } from '../data/models.js'

const roleLabel = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.CREW]: 'Crew',
}

const roleDesc = {
  [ROLES.ADMIN]: 'Full access — productions, analytics, reports',
  [ROLES.SUPERVISOR]: 'Create & manage productions, assign tasks',
  [ROLES.CREW]: 'View assignments, log add-ons, complete tasks',
}

export function LoginPage() {
  const { currentUser, login } = useApp()
  const navigate = useNavigate()

  if (currentUser) return <Navigate to="/dashboard" replace />

  const handleLogin = (userId) => {
    login(userId)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-orbital-bg px-6 py-12">
      {/* Logo / brand */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-orbital-text tracking-tight mb-1">Balance</h1>
        <p className="text-orbital-subtle text-sm font-medium">
          Virtual Production Management — Orbital Studios
        </p>
      </div>

      {/* Profile selector */}
      <div className="w-full max-w-md">
        <p className="section-title text-center mb-5">Select your profile</p>
        <div className="space-y-3">
          {USERS.map((user) => (
            <button
              key={user.id}
              onClick={() => handleLogin(user.id)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-orbital-surface border border-orbital-border hover:border-blue-500/50 hover:bg-orbital-muted transition-all group active:scale-[0.98]"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg flex-shrink-0"
                style={{ backgroundColor: user.color }}
              >
                {user.avatar}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-orbital-text">{user.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-orbital-muted text-orbital-subtle font-medium">
                    {roleLabel[user.role]}
                  </span>
                </div>
                <p className="text-xs text-orbital-subtle mt-0.5">{roleDesc[user.role]}</p>
              </div>
              <svg className="w-5 h-5 text-orbital-subtle group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-orbital-muted text-center">
        Balance v1 — Built by Danny Horgan in partnership with Orbital Studios
      </p>
    </div>
  )
}
