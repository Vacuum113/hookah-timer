import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import type { AppState, Hall, Program, Session, Settings } from './types'
import { advanceSession, isFreshAlert, shouldRepeatAlert, startSession, confirmStage, pauseSession, resumeSession, extendSession, type AlertEvent } from './lib/engine'
import { loadState, saveState, STORAGE_KEY } from './lib/storage'
import { createInitialState } from './lib/defaults'
import { playSessionEndAlert, playStageAlert } from './lib/sound'
import { showNotification } from './lib/notify'

const HISTORY_LIMIT = 500

type StoreState = { data: AppState; alerts: AlertEvent[] }

type Action =
  | { type: 'tick'; now: number }
  | { type: 'start-session'; tableId: string; programId?: string; now: number }
  | { type: 'confirm'; sessionId: string; now: number }
  | { type: 'pause'; sessionId: string; now: number }
  | { type: 'resume'; sessionId: string; now: number }
  | { type: 'extend'; sessionId: string; ms: number; now: number }
  | { type: 'close-session'; sessionId: string; now: number }
  | { type: 'save-hall'; hall: Hall }
  | { type: 'save-programs'; programs: Program[]; defaultProgramId: string }
  | { type: 'update-settings'; patch: Partial<Settings> }
  | { type: 'clear-history' }
  | { type: 'reset-all' }
  | { type: 'consume-alerts' }
  | { type: 'external-state'; data: AppState }

function nextLabel(sessions: Session[], tableId: string): string {
  const used = sessions
    .filter((s) => s.tableId === tableId)
    .map((s) => Number(s.label.replace(/\D+/g, '')) || 0)
  const n = used.length ? Math.max(...used) + 1 : 1
  return `Кальян ${n}`
}

function mapSession(
  state: StoreState,
  sessionId: string,
  fn: (session: Session, program: Program) => Session,
): StoreState {
  let changed = false
  const sessions = state.data.sessions.map((session) => {
    if (session.id !== sessionId) return session
    const program = state.data.programs.find((p) => p.id === session.programId)
    if (!program) return session
    const next = fn(session, program)
    if (next !== session) changed = true
    return next
  })
  if (!changed) return state
  return { ...state, data: { ...state.data, sessions } }
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'tick': {
      const { now } = action
      let changed = false
      const alerts: AlertEvent[] = []
      const sessions = state.data.sessions.map((session) => {
        const program = state.data.programs.find((p) => p.id === session.programId)
        if (!program) return session
        const advanced = advanceSession(session, program, now)
        let next = advanced.session
        alerts.push(...advanced.alerts)
        if (shouldRepeatAlert(next, now, state.data.settings.alertRepeatSec)) {
          const stage = program.intervals[next.stageIndex]
          alerts.push({
            sessionId: next.id,
            at: now,
            kind: 'stage-end',
            stageName: stage?.name ?? '',
          })
          next = { ...next, lastAlertAt: now }
        }
        if (next !== session) changed = true
        return next
      })
      if (!changed && alerts.length === 0) return state
      return {
        data: changed ? { ...state.data, sessions } : state.data,
        alerts: alerts.length ? [...state.alerts, ...alerts] : state.alerts,
      }
    }

    case 'start-session': {
      const programId = action.programId ?? state.data.settings.defaultProgramId
      const program =
        state.data.programs.find((p) => p.id === programId) ?? state.data.programs[0]
      if (!program) return state
      const session = startSession(
        action.tableId,
        program,
        nextLabel(state.data.sessions, action.tableId),
        action.now,
      )
      return {
        ...state,
        data: { ...state.data, sessions: [...state.data.sessions, session] },
      }
    }

    case 'confirm':
      return mapSession(state, action.sessionId, (s, p) => confirmStage(s, p, action.now))
    case 'pause':
      return mapSession(state, action.sessionId, (s) => pauseSession(s, action.now))
    case 'resume':
      return mapSession(state, action.sessionId, (s) => resumeSession(s, action.now))
    case 'extend':
      return mapSession(state, action.sessionId, (s) => extendSession(s, action.ms, action.now))

    case 'close-session': {
      const session = state.data.sessions.find((s) => s.id === action.sessionId)
      if (!session) return state
      const table = state.data.hall.tables.find((t) => t.id === session.tableId)
      const program = state.data.programs.find((p) => p.id === session.programId)
      const entry = {
        id: session.id,
        tableId: session.tableId,
        tableName: table?.name ?? 'Стол',
        programName: program?.name ?? 'Программа',
        startedAt: session.startedAt,
        closedAt: action.now,
      }
      return {
        ...state,
        data: {
          ...state.data,
          sessions: state.data.sessions.filter((s) => s.id !== action.sessionId),
          history: [entry, ...state.data.history].slice(0, HISTORY_LIMIT),
        },
      }
    }

    case 'save-hall': {
      const tableIds = new Set(action.hall.tables.map((t) => t.id))
      return {
        ...state,
        data: {
          ...state.data,
          hall: action.hall,
          // Кальяны с удалённых столов не должны остаться висеть.
          sessions: state.data.sessions.filter((s) => tableIds.has(s.tableId)),
        },
      }
    }

    case 'save-programs': {
      const ids = new Set(action.programs.map((p) => p.id))
      const defaultProgramId = ids.has(action.defaultProgramId)
        ? action.defaultProgramId
        : (action.programs[0]?.id ?? '')
      return {
        ...state,
        data: {
          ...state.data,
          programs: action.programs,
          settings: { ...state.data.settings, defaultProgramId },
        },
      }
    }

    case 'update-settings':
      return {
        ...state,
        data: { ...state.data, settings: { ...state.data.settings, ...action.patch } },
      }

    case 'clear-history':
      return { ...state, data: { ...state.data, history: [] } }

    case 'reset-all':
      return { data: createInitialState(), alerts: [] }

    // Состояние изменила другая вкладка — подхватываем её версию.
    case 'external-state':
      return { ...state, data: action.data }

    case 'consume-alerts':
      return state.alerts.length ? { ...state, alerts: [] } : state

    default:
      return state
  }
}

type StoreValue = {
  state: AppState
  now: number
  dispatch: (action: Action) => void
  actions: {
    startSession: (tableId: string, programId?: string) => void
    confirm: (sessionId: string) => void
    pause: (sessionId: string) => void
    resume: (sessionId: string) => void
    extend: (sessionId: string, ms: number) => void
    closeSession: (sessionId: string) => void
    saveHall: (hall: Hall) => void
    savePrograms: (programs: Program[], defaultProgramId: string) => void
    updateSettings: (patch: Partial<Settings>) => void
    clearHistory: () => void
    resetAll: () => void
  }
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(reducer, undefined, () => ({
    data: loadState(),
    alerts: [] as AlertEvent[],
  }))
  const [now, setNow] = useState(() => Date.now())
  // Тикаем раз в секунду и сразу после возвращения на вкладку.
  useEffect(() => {
    const tick = () => {
      const ts = Date.now()
      setNow(ts)
      dispatch({ type: 'tick', now: ts })
    }
    tick()
    const id = window.setInterval(tick, 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  // Приложение может быть открыто в нескольких вкладках — синхронизируем их.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== STORAGE_KEY) return
      dispatch({ type: 'external-state', data: loadState() })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Сохраняем состояние с небольшой задержкой, чтобы не писать на каждый тик.
  useEffect(() => {
    const id = window.setTimeout(() => saveState(store.data), 250)
    return () => window.clearTimeout(id)
  }, [store.data])

  // Отыгрываем сигналы: звук + браузерное уведомление.
  useEffect(() => {
    if (store.alerts.length === 0) return
    const ts = Date.now()
    const settings = store.data.settings
    const fresh = store.alerts.filter((a) => isFreshAlert(a, ts))
    if (fresh.length) {
      if (settings.soundEnabled) {
        if (fresh.some((a) => a.kind === 'session-end')) playSessionEndAlert()
        else playStageAlert()
      }
      if (settings.notificationsEnabled) {
        for (const alert of fresh.slice(0, 3)) {
          const session = store.data.sessions.find((s) => s.id === alert.sessionId)
          const table = store.data.hall.tables.find((t) => t.id === session?.tableId)
          const where = `${table?.name ?? 'Стол'} · ${session?.label ?? ''}`.trim()
          if (alert.kind === 'session-end') {
            showNotification('Кальян отработал', where, alert.sessionId)
          } else {
            showNotification(`${alert.stageName} — готово`, where, alert.sessionId)
          }
        }
      }
    }
    dispatch({ type: 'consume-alerts' })
  }, [store.alerts, store.data])

  const actions = useMemo<StoreValue['actions']>(
    () => ({
      startSession: (tableId, programId) =>
        dispatch({ type: 'start-session', tableId, programId, now: Date.now() }),
      confirm: (sessionId) => dispatch({ type: 'confirm', sessionId, now: Date.now() }),
      pause: (sessionId) => dispatch({ type: 'pause', sessionId, now: Date.now() }),
      resume: (sessionId) => dispatch({ type: 'resume', sessionId, now: Date.now() }),
      extend: (sessionId, ms) => dispatch({ type: 'extend', sessionId, ms, now: Date.now() }),
      closeSession: (sessionId) =>
        dispatch({ type: 'close-session', sessionId, now: Date.now() }),
      saveHall: (hall) => dispatch({ type: 'save-hall', hall }),
      savePrograms: (programs, defaultProgramId) =>
        dispatch({ type: 'save-programs', programs, defaultProgramId }),
      updateSettings: (patch) => dispatch({ type: 'update-settings', patch }),
      clearHistory: () => dispatch({ type: 'clear-history' }),
      resetAll: () => dispatch({ type: 'reset-all' }),
    }),
    [],
  )

  const value = useMemo<StoreValue>(
    () => ({ state: store.data, now, dispatch, actions }),
    [store.data, now, actions],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore должен вызываться внутри StoreProvider')
  return value
}
