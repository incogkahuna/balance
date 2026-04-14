import { useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { isPast, parseISO } from 'date-fns'
import { CheckSquare, AlertTriangle, Clock, CheckCheck, ListTodo } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES } from '../data/models.js'
import { TaskCard } from '../components/tasks/TaskCard.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'
import clsx from 'clsx'

// ─── Filter definitions ────────────────────────────────────────────────────
// Each filter is a named scope that maps a URL param (?filter=...) to a
// predicate. Keeping these declarative so new filters slot in cleanly.
const FILTERS = {
  all:       { label: 'All',          icon: ListTodo },
  mine:      { label: 'Mine',         icon: CheckSquare },
  overdue:   { label: 'Overdue',      icon: AlertTriangle },
  pending:   { label: 'Awaiting Verification', icon: Clock },
  verified:  { label: 'Verified',     icon: CheckCheck },
}

export function TasksPage() {
  const { currentUser, tasks } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const filter = searchParams.get('filter') || 'mine'

  const setFilter = (next) => {
    if (next === 'mine') setSearchParams({})
    else setSearchParams({ filter: next })
  }

  const isCrew = currentUser?.role === ROLES.CREW

  const filtered = useMemo(() => {
    // Crew always see only their own tasks regardless of filter.
    let list = isCrew
      ? tasks.filter(t => t.assigneeId === currentUser?.id)
      : tasks

    switch (filter) {
      case 'mine':
        list = list.filter(t =>
          t.assigneeId === currentUser?.id && !t.verifiedComplete
        )
        break
      case 'overdue':
        list = list.filter(t =>
          t.dueDate && !t.verifiedComplete && isPast(parseISO(t.dueDate))
        )
        break
      case 'pending':
        list = list.filter(t => t.reportedComplete && !t.verifiedComplete)
        break
      case 'verified':
        list = list.filter(t => t.verifiedComplete)
        break
      case 'all':
      default:
        break
    }

    // Sort: overdue first, then by due date ascending, then undated last.
    return list.slice().sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate) - new Date(b.dueDate)
    })
  }, [tasks, filter, currentUser, isCrew])

  // Crew cannot see the "pending verification" filter — it's an admin concern.
  const availableFilters = Object.entries(FILTERS).filter(([key]) => {
    if (isCrew && key === 'pending') return false
    return true
  })

  return (
    <div>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <h1 className="text-xl font-bold text-orbital-text mb-6">Tasks</h1>

        {/* Filter chips */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
          {availableFilters.map(([key, { label, icon: Icon }]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors active:scale-[0.97]',
                filter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-orbital-surface border border-orbital-border text-orbital-subtle hover:text-orbital-text'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks to show"
            description={
              filter === 'mine'    ? 'You have no active tasks right now.' :
              filter === 'overdue' ? 'Nothing overdue — clean slate.' :
              filter === 'pending' ? 'No tasks awaiting verification.' :
              filter === 'verified'? 'No verified tasks yet.' :
              'No tasks in the system.'
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                productionId={task.productionId}
                showProduction
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
