import type { AppState, Table } from '../types'
import { createInitialState, DEFAULT_TABLE_SIZE, STATE_VERSION } from './defaults'

export const STORAGE_KEY = 'hookah-timer:state:v1'
const KEY = STORAGE_KEY

/** Раскладка v1: столы стояли в ячейках сетки cols × rows. */
type LegacyTable = Table & { w?: number; h?: number }
type LegacyState = Omit<AppState, 'hall'> & {
  hall: { cols?: number; rows?: number; tableSize?: number; tables: LegacyTable[] }
}

/** Переводит сеточную раскладку в свободные координаты (проценты холста). */
function migrate(state: LegacyState): AppState {
  if (state.version === STATE_VERSION) return state as unknown as AppState
  const cols = state.hall.cols ?? 12
  const rows = state.hall.rows ?? 6
  return {
    ...(state as unknown as AppState),
    version: STATE_VERSION,
    hall: {
      tableSize: DEFAULT_TABLE_SIZE,
      tables: state.hall.tables.map((t) => ({
        id: t.id,
        name: t.name,
        x: ((t.x + (t.w ?? 1) / 2) / cols) * 100,
        y: ((t.y + (t.h ?? 1) / 2) / rows) * 100,
      })),
    },
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as LegacyState
    if (!parsed?.hall?.tables) return createInitialState()
    const state = migrate(parsed)
    const initial = createInitialState()
    // Подстраховка от частично записанного состояния.
    return {
      ...initial,
      ...state,
      hall: { tableSize: state.hall.tableSize || DEFAULT_TABLE_SIZE, tables: state.hall.tables },
      settings: { ...initial.settings, ...state.settings },
    }
  } catch {
    return createInitialState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Приватный режим или переполненное хранилище — работаем без сохранения.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* игнорируем */
  }
}
