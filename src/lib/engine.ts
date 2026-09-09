import type { Interval, Program, Session } from '../types'
import { uid } from './id'

/** Сигнал, который UI должен отыграть: звук, уведомление, подсветка. */
export type AlertEvent = {
  sessionId: string
  /** Момент, когда событие фактически произошло, ms. */
  at: number
  kind: 'stage-end' | 'session-end'
  stageName: string
}

/** Сигналы старше этого возраста не отыгрываются — они «догнаны» после сна вкладки. */
const ALERT_MAX_AGE_MS = 2 * 60 * 1000

export function currentInterval(program: Program, session: Session): Interval | null {
  return program.intervals[session.stageIndex] ?? null
}

export function startSession(
  tableId: string,
  program: Program,
  label: string,
  now: number,
): Session {
  const first = program.intervals[0]
  return {
    id: uid('ses-'),
    tableId,
    programId: program.id,
    label,
    stageIndex: 0,
    repeatIndex: 0,
    stageStartedAt: now,
    stageEndsAt: now + (first ? first.durationSec * 1000 : 0),
    state: first ? 'running' : 'overtime',
    pausedAt: null,
    pendingSince: first ? null : now,
    lastAlertAt: null,
    startedAt: now,
  }
}

/**
 * Догоняет состояние сессии до момента `now`, обрабатывая все пропущенные переходы.
 * Считает от абсолютных времён, поэтому корректно переживает перезагрузку и сон вкладки.
 */
export function advanceSession(
  session: Session,
  program: Program,
  now: number,
): { session: Session; alerts: AlertEvent[] } {
  const alerts: AlertEvent[] = []
  let s = session
  // Ограничение на случай нулевых длительностей — защита от бесконечного цикла.
  let guard = 0

  while (s.state === 'running' && guard++ < 1000) {
    const interval = program.intervals[s.stageIndex]
    if (!interval) {
      s = { ...s, state: 'overtime', pendingSince: s.stageEndsAt, lastAlertAt: null }
      alerts.push({ sessionId: s.id, at: s.stageEndsAt, kind: 'session-end', stageName: '' })
      break
    }
    if (now < s.stageEndsAt) break

    const endedAt = s.stageEndsAt
    const hasMoreRepeats = s.repeatIndex + 1 < Math.max(1, interval.repeat)
    const isLastStage = s.stageIndex + 1 >= program.intervals.length
    const finishesSession = !hasMoreRepeats && isLastStage

    alerts.push({
      sessionId: s.id,
      at: endedAt,
      kind: finishesSession ? 'session-end' : 'stage-end',
      stageName: interval.name,
    })

    if (!interval.autoNext) {
      s = { ...s, state: 'awaiting', pendingSince: endedAt, lastAlertAt: null }
      break
    }
    s = advanceStage(s, program, endedAt)
  }

  return { session: s, alerts }
}

/** Переводит сессию на следующий проход/этап начиная с момента `from`. */
function advanceStage(session: Session, program: Program, from: number): Session {
  const interval = program.intervals[session.stageIndex]
  if (!interval) {
    return { ...session, state: 'overtime', pendingSince: from, lastAlertAt: null }
  }
  const hasMoreRepeats = session.repeatIndex + 1 < Math.max(1, interval.repeat)

  if (hasMoreRepeats) {
    return {
      ...session,
      repeatIndex: session.repeatIndex + 1,
      stageStartedAt: from,
      stageEndsAt: from + interval.durationSec * 1000,
      state: 'running',
      pendingSince: null,
      lastAlertAt: null,
    }
  }

  const nextIndex = session.stageIndex + 1
  const next = program.intervals[nextIndex]
  if (!next) {
    return {
      ...session,
      stageIndex: nextIndex,
      repeatIndex: 0,
      state: 'overtime',
      pendingSince: from,
      lastAlertAt: null,
    }
  }
  return {
    ...session,
    stageIndex: nextIndex,
    repeatIndex: 0,
    stageStartedAt: from,
    stageEndsAt: from + next.durationSec * 1000,
    state: 'running',
    pendingSince: null,
    lastAlertAt: null,
  }
}

/** Мастер подтвердил, что обслужил стол → запускаем следующий проход. */
export function confirmStage(session: Session, program: Program, now: number): Session {
  if (session.state !== 'awaiting') return session
  return advanceStage(session, program, now)
}

export function pauseSession(session: Session, now: number): Session {
  if (session.state !== 'running') return session
  return { ...session, state: 'paused', pausedAt: now }
}

export function resumeSession(session: Session, now: number): Session {
  if (session.state !== 'paused' || session.pausedAt == null) return session
  const delta = now - session.pausedAt
  return {
    ...session,
    state: 'running',
    pausedAt: null,
    stageStartedAt: session.stageStartedAt + delta,
    stageEndsAt: session.stageEndsAt + delta,
  }
}

/** Продлить текущий этап. В ожидании и овертайме — возобновляет отсчёт. */
export function extendSession(session: Session, ms: number, now: number): Session {
  if (session.state === 'running' || session.state === 'paused') {
    return { ...session, stageEndsAt: session.stageEndsAt + ms }
  }
  return {
    ...session,
    state: 'running',
    stageStartedAt: now,
    stageEndsAt: now + ms,
    pendingSince: null,
    lastAlertAt: null,
  }
}

/** Остаток текущего этапа в мс (может быть отрицательным — просрочка). */
export function remainingMs(session: Session, now: number): number {
  if (session.state === 'paused' && session.pausedAt != null) {
    return session.stageEndsAt - session.pausedAt
  }
  return session.stageEndsAt - now
}

/** Прогресс текущего этапа 0..1. */
export function stageProgress(session: Session, now: number): number {
  const total = session.stageEndsAt - session.stageStartedAt
  if (total <= 0) return 1
  const point = session.state === 'paused' && session.pausedAt != null ? session.pausedAt : now
  return Math.min(1, Math.max(0, (point - session.stageStartedAt) / total))
}

/** Сколько времени стол ждёт действия мастера, мс. */
export function pendingMs(session: Session, now: number): number {
  if (session.pendingSince == null) return 0
  return now - session.pendingSince
}

/** Нужно ли повторить сигнал по ожидающей сессии. */
export function shouldRepeatAlert(session: Session, now: number, repeatSec: number): boolean {
  if (session.state !== 'awaiting' || session.pendingSince == null) return false
  const last = session.lastAlertAt ?? session.pendingSince
  return now - last >= repeatSec * 1000
}

export function isFreshAlert(alert: AlertEvent, now: number): boolean {
  return now - alert.at <= ALERT_MAX_AGE_MS
}
