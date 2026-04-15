import { useMemo } from 'react'
import { format, parseISO, isToday, isPast, isSameDay } from 'date-fns'
import { Plus } from 'lucide-react'
import { MILESTONE_TYPE_CONFIG } from './roadmapUtils.js'
import { MilestoneCard } from './MilestoneCard.jsx'
import clsx from 'clsx'

// Groups milestones into dated sections:  past | today | future date groups
function groupMilestones(milestones) {
  const sorted = [...milestones].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })

  const groups = []   // [{ label, date, milestones, isPast, isToday }]

  sorted.forEach(m => {
    const date = m.date ? parseISO(m.date) : null
    const past  = date && isPast(date) && !isToday(date)
    const today = date && isToday(date)

    // Find existing group for this date
    const key = date ? format(date, 'yyyy-MM-dd') : 'undated'
    let group = groups.find(g => g.key === key)
    if (!group) {
      group = {
        key,
        label: date
          ? today
            ? 'Today'
            : format(date, 'EEEE, MMMM d')
          : 'No Date',
        date,
        isPast: past,
        isToday: today,
        milestones: [],
      }
      groups.push(group)
    }
    group.milestones.push(m)
  })

  return groups
}

export function Timeline({ milestones, canEdit, onEdit, onDelete, onAdd }) {
  const groups = useMemo(() => groupMilestones(milestones), [milestones])

  if (milestones.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-orbital-muted flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📅</span>
        </div>
        <p className="text-orbital-text font-medium mb-1">No milestones yet</p>
        <p className="text-sm text-orbital-subtle mb-4">
          Start building your production timeline by adding the first milestone.
        </p>
        {canEdit && (
          <button onClick={onAdd} className="btn-primary">
            <Plus size={15} /> Add First Milestone
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[17px] top-0 bottom-0 w-px bg-orbital-border" />

      <div className="space-y-1">
        {groups.map((group, gi) => (
          <div key={group.key}>
            {/* Date section header */}
            <div className={clsx(
              'flex items-center gap-3 mb-3',
              gi > 0 && 'mt-6'
            )}>
              {/* Node on the line */}
              <div className={clsx(
                'w-[35px] h-[35px] rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2',
                group.isToday
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : group.isPast
                  ? 'bg-orbital-surface border-orbital-border'
                  : 'bg-orbital-muted border-orbital-border'
              )}>
                <span className={clsx(
                  'text-xs font-bold',
                  group.isToday ? 'text-white' : 'text-orbital-subtle'
                )}>
                  {group.date ? format(group.date, 'd') : '?'}
                </span>
              </div>

              {/* Date label */}
              <span className={clsx(
                'text-sm font-semibold',
                group.isToday ? 'text-blue-400' :
                group.isPast  ? 'text-orbital-subtle' :
                                'text-orbital-text'
              )}>
                {group.label}
                {group.date && !group.isToday && (
                  <span className="ml-2 text-xs font-normal text-orbital-subtle">
                    {format(group.date, 'yyyy')}
                  </span>
                )}
              </span>
            </div>

            {/* Milestone cards in this group */}
            <div className={clsx('ml-[47px] space-y-2 mb-2', group.isPast && 'opacity-60')}>
              {group.milestones.map(milestone => {
                const typeCfg = MILESTONE_TYPE_CONFIG[milestone.type] || MILESTONE_TYPE_CONFIG['Pre-Production']
                return (
                  <div key={milestone.id} className="relative">
                    {/* Connector from line to card */}
                    <div
                      className="absolute -left-[30px] top-1/2 w-[30px] h-px -translate-y-1/2"
                      style={{ backgroundColor: typeCfg.color + '60' }}
                    />
                    {/* Type color dot on the line */}
                    <div
                      className="absolute -left-[35px] top-1/2 w-2 h-2 rounded-full -translate-y-1/2 z-10"
                      style={{ backgroundColor: typeCfg.color }}
                    />
                    <MilestoneCard
                      milestone={milestone}
                      canEdit={canEdit}
                      onEdit={() => onEdit(milestone)}
                      onDelete={() => onDelete(milestone.id)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
