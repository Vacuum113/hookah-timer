import { useEffect, useState } from 'react'
import type { Program, Session } from '../types'
import { pendingMs, remainingMs, stageProgress } from '../lib/engine'
import { formatDuration } from '../lib/format'
import { useStore } from '../store'

/** Порог, с которого таймер подсвечивается жёлтым, сек. */
const SOON_SEC = 60

type Props = { session: Session; program: Program }

export function SessionCard({ session, program }: Props) {
  const { now, actions } = useStore()
  const [confirmClose, setConfirmClose] = useState(false)
  const interval = program.intervals[session.stageIndex] ?? null
  const repeats = Math.max(1, interval?.repeat ?? 1)

  useEffect(() => {
    if (!confirmClose) return
    const id = window.setTimeout(() => setConfirmClose(false), 3000)
    return () => window.clearTimeout(id)
  }, [confirmClose])

  const close = () => {
    if (session.state === 'overtime' || confirmClose) {
      actions.closeSession(session.id)
      return
    }
    setConfirmClose(true)
  }

  const remaining = remainingMs(session, now)
  const pending = pendingMs(session, now)
  const progress = stageProgress(session, now)

  let timeText: string
  let timeClass = ''
  if (session.state === 'awaiting') {
    timeText = `+${formatDuration(pending / 1000)}`
    timeClass = 'danger'
  } else if (session.state === 'overtime') {
    timeText = `+${formatDuration(pending / 1000)}`
    timeClass = 'warn'
  } else {
    timeText = formatDuration(remaining / 1000)
    if (remaining <= SOON_SEC * 1000) timeClass = 'warn'
  }

  const stageText =
    session.state === 'overtime'
      ? 'Отработал — можно закрывать'
      : `${interval?.name ?? 'Этап'}${repeats > 1 ? ` ${session.repeatIndex + 1}/${repeats}` : ''}`

  return (
    <div
      className={`session ${session.state}`}
      style={{ ['--program-color' as string]: program.color }}
    >
      <div className="session-top">
        <span className="session-label">
          {session.label} · {program.name}
        </span>
        <span className="stage-dots" aria-hidden="true">
          {program.intervals.map((iv, i) => (
            <i
              key={iv.id}
              className={i < session.stageIndex ? 'done' : i === session.stageIndex ? 'active' : ''}
            />
          ))}
        </span>
      </div>

      <div className="session-stage">{stageText}</div>
      <div className={`session-time ${timeClass}`}>
        {timeText}
        {session.state === 'paused' && <span className="session-label"> · пауза</span>}
      </div>

      {session.state !== 'overtime' && (
        <div className={`progress ${session.state === 'awaiting' ? 'danger' : ''}`}>
          <i style={{ width: `${(session.state === 'awaiting' ? 1 : progress) * 100}%` }} />
        </div>
      )}

      <div className="session-actions">
        {session.state === 'awaiting' && (
          <button className="chip accent" onClick={() => actions.confirm(session.id)}>
            Готово
          </button>
        )}
        {session.state === 'running' && (
          <button className="chip" onClick={() => actions.pause(session.id)}>
            Пауза
          </button>
        )}
        {session.state === 'paused' && (
          <button className="chip" onClick={() => actions.resume(session.id)}>
            Продолжить
          </button>
        )}
        <button className="chip" onClick={() => actions.extend(session.id, 5 * 60 * 1000)}>
          +5 мин
        </button>
        <button className={`chip ${confirmClose ? 'accent' : 'done'}`} onClick={close}>
          {confirmClose ? 'Точно закрыть?' : 'Закрыть'}
        </button>
      </div>
    </div>
  )
}
