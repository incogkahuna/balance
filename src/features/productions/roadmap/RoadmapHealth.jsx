import { computeRoadmapHealth, HEALTH_CONFIG, ROADMAP_HEALTH } from './roadmapUtils.js'
import clsx from 'clsx'

/**
 * Compact health badge for use anywhere — card, header, dashboard.
 * Pass `roadmap` from production.roadmap.
 */
export function RoadmapHealth({ roadmap, className, showLabel = true }) {
  const health = computeRoadmapHealth(roadmap)
  const cfg    = HEALTH_CONFIG[health]

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium',
      cfg.pill,
      className
    )}>
      <span className="text-[8px] leading-none">{cfg.dot}</span>
      {showLabel && health}
    </span>
  )
}
