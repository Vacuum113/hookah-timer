import type { AppState, Program } from '../types'
import { uid } from './id'

export const STATE_VERSION = 2

export const PROGRAM_COLORS = [
  '#e8833a',
  '#3aa0e8',
  '#57b96a',
  '#b45ad6',
  '#d64f6a',
  '#c9a227',
]

function defaultPrograms(): Program[] {
  return [
    {
      id: 'prog-classic',
      name: 'Классика',
      color: PROGRAM_COLORS[0],
      intervals: [
        { id: uid('int-'), name: 'Забивка кальяна', durationSec: 15 * 60, autoNext: false, repeat: 1 },
        { id: uid('int-'), name: 'Прогрев чаши', durationSec: 10 * 60, autoNext: true, repeat: 1 },
        { id: uid('int-'), name: 'Уголь / перемешать', durationSec: 20 * 60, autoNext: false, repeat: 3 },
      ],
    },
    {
      id: 'prog-fruit',
      name: 'Фруктовая чаша',
      color: PROGRAM_COLORS[1],
      intervals: [
        { id: uid('int-'), name: 'Нарезка и забивка', durationSec: 20 * 60, autoNext: false, repeat: 1 },
        { id: uid('int-'), name: 'Прогрев чаши', durationSec: 12 * 60, autoNext: true, repeat: 1 },
        { id: uid('int-'), name: 'Уголь / перемешать', durationSec: 25 * 60, autoNext: false, repeat: 3 },
      ],
    },
  ]
}

export const DEFAULT_TABLE_SIZE = 132

export function createInitialState(): AppState {
  const programs = defaultPrograms()
  return {
    version: STATE_VERSION,
    // Зал пустой: столы заведение расставляет само в редакторе.
    hall: { tableSize: DEFAULT_TABLE_SIZE, tables: [] },
    programs,
    sessions: [],
    history: [],
    settings: {
      soundEnabled: true,
      notificationsEnabled: false,
      defaultProgramId: programs[0].id,
      alertRepeatSec: 30,
    },
  }
}
