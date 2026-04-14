import clsx from 'clsx'

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-orbital-muted flex items-center justify-center mb-4">
          <Icon size={24} className="text-orbital-subtle" />
        </div>
      )}
      <h3 className="font-semibold text-orbital-text mb-1">{title}</h3>
      {description && <p className="text-sm text-orbital-subtle max-w-xs mb-5">{description}</p>}
      {action}
    </div>
  )
}
