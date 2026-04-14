import clsx from 'clsx'
import { USERS } from '../../data/models.js'

export function Avatar({ userId, size = 'sm', className, showName = false }) {
  const user = USERS.find(u => u.id === userId)
  if (!user) return null

  const sizeClass = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  }[size]

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx('rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0', sizeClass)}
        style={{ backgroundColor: user.color }}
      >
        {user.avatar}
      </div>
      {showName && <span className="text-sm text-orbital-text">{user.name}</span>}
    </div>
  )
}

export function AvatarGroup({ userIds, max = 4, size = 'sm' }) {
  const visible = userIds.slice(0, max)
  const overflow = userIds.length - max

  const sizeClass = {
    xs: 'w-6 h-6 text-xs -ml-1.5',
    sm: 'w-7 h-7 text-xs -ml-2',
    md: 'w-9 h-9 text-sm -ml-2',
  }[size]

  return (
    <div className="flex items-center">
      {visible.map((uid, i) => {
        const user = USERS.find(u => u.id === uid)
        if (!user) return null
        return (
          <div
            key={uid}
            title={user.name}
            className={clsx(
              'rounded-full flex items-center justify-center font-semibold text-white border-2 border-orbital-surface flex-shrink-0',
              sizeClass,
              i === 0 ? 'ml-0' : ''
            )}
            style={{ backgroundColor: user.color }}
          >
            {user.avatar}
          </div>
        )
      })}
      {overflow > 0 && (
        <div className={clsx(
          'rounded-full flex items-center justify-center font-semibold bg-orbital-muted text-orbital-subtle border-2 border-orbital-surface',
          sizeClass
        )}>
          +{overflow}
        </div>
      )}
    </div>
  )
}
