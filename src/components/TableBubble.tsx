import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Program, Session, Table } from '../types'
import { pendingMs, remainingMs, stageProgress } from '../lib/engine'
import { formatDuration } from '../lib/format'

/** Порог, с которого таймер подсвечивается жёлтым, сек. */
const SOON_SEC = 60

/** Какой из кальянов стола показывать на кружке: сначала те, что требуют мастера. */
export function primarySession(sessions: Session[], now: number): Session | null {
  if (sessions.length === 0) return null
  const rank = (s: Session) =>
    s.state === 'awaiting' ? 0 : s.state === 'overtime' ? 1 : s.state === 'running' ? 2 : 3
  return [...sessions].sort((a, b) => {
    const diff = rank(a) - rank(b)
    if (diff !== 0) return diff
    return remainingMs(a, now) - remainingMs(b, now)
  })[0]
}

type Props = {
  table: Table
  sessions: Session[]
  programs: Program[]
  size: number
  now: number
  /** В режиме редактора кружок перетаскивается, а таймеры не кликабельны. */
  editing?: boolean
  selected?: boolean
  dragging?: boolean
  positioned?: boolean
  onClick?: () => void
  onPointerDown?: (e: ReactPointerEvent) => void
}

export function TableBubble({
  table,
  sessions,
  programs,
  size,
  now,
  editing = false,
  selected = false,
  dragging = false,
  positioned = true,
  onClick,
  onPointerDown,
}: Props) {
  const primary = primarySession(sessions, now)
  const program = primary ? programs.find((p) => p.id === primary.programId) : undefined
  const attention = sessions.some((s) => s.state === 'awaiting')
  const overtime = !attention && sessions.some((s) => s.state === 'overtime')

  // Состояние важнее цвета программы: ждём мастера — красный, отработал — жёлтый.
  const ringColor = attention
    ? 'var(--danger)'
    : overtime
      ? 'var(--warn)'
      : (program?.color ?? 'var(--accent)')

  const style: React.CSSProperties = {
    ['--size' as string]: `${size}px`,
    ['--ring-color' as string]: ringColor,
    ...(positioned ? { left: `${table.x}%`, top: `${table.y}%` } : null),
  }

  const className = [
    'bubble',
    sessions.length === 0 ? 'free' : '',
    attention ? 'attention' : '',
    overtime ? 'overtime' : '',
    editing ? 'editing' : '',
    selected ? 'selected' : '',
    dragging ? 'dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!primary) {
    return (
      <button
        className={className}
        style={style}
        onClick={onClick}
        onPointerDown={onPointerDown}
        title={`${table.name} — свободен`}
      >
        <span className="bubble-face">
          <span className="bubble-name">{table.name}</span>
          <span className="bubble-plus">+</span>
          <span className="bubble-stage">свободен</span>
        </span>
      </button>
    )
  }

  const interval = program?.intervals[primary.stageIndex] ?? null
  const repeats = Math.max(1, interval?.repeat ?? 1)
  const remaining = remainingMs(primary, now)

  let timeText: string
  let timeClass = ''
  let progress = stageProgress(primary, now)

  if (primary.state === 'awaiting') {
    timeText = `+${formatDuration(pendingMs(primary, now) / 1000)}`
    timeClass = 'danger'
    progress = 1
  } else if (primary.state === 'overtime') {
    timeText = `+${formatDuration(pendingMs(primary, now) / 1000)}`
    timeClass = 'warn'
    progress = 1
  } else {
    timeText = formatDuration(remaining / 1000)
    if (remaining <= SOON_SEC * 1000) timeClass = 'warn'
  }

  const stageText =
    primary.state === 'overtime'
      ? 'отработал'
      : primary.state === 'paused'
        ? 'пауза'
        : `${interval?.name ?? ''}${repeats > 1 ? ` ${primary.repeatIndex + 1}/${repeats}` : ''}`

  return (
    <button
      className={className}
      style={{ ...style, ['--progress' as string]: progress }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      title={`${table.name} · ${stageText}`}
    >
      <span className="bubble-face">
        <span className="bubble-name">{table.name}</span>
        <span className={`bubble-time ${timeClass}`}>{timeText}</span>
        <span className="bubble-stage">{stageText}</span>
        {program && program.intervals.length > 1 && (
          <span className="bubble-dots" aria-hidden="true">
            {program.intervals.map((iv, i) => (
              <i
                key={iv.id}
                className={
                  i < primary.stageIndex ? 'done' : i === primary.stageIndex ? 'active' : ''
                }
              />
            ))}
          </span>
        )}
      </span>
      {sessions.length > 1 && <span className="bubble-badge">×{sessions.length}</span>}
    </button>
  )
}
