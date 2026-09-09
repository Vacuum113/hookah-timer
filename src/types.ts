/** Интервал программы: этап работы с кальяном. */
export type Interval = {
  id: string
  /** Название этапа: «Забивка», «Прогрев чаши», «Уголь». */
  name: string
  /** Длительность одного прохода, в секундах. */
  durationSec: number
  /** Переходить к следующему этапу автоматически или ждать подтверждения мастера. */
  autoNext: boolean
  /** Сколько раз подряд повторить этап (цикличный интервал: «уголь каждые 20 мин × 3»). */
  repeat: number
}

/** Программа — именованный набор интервалов. */
export type Program = {
  id: string
  name: string
  /** Цвет-акцент карточки, чтобы программы различались на экране зала. */
  color: string
  intervals: Interval[]
}

/** Стол в зале: свободная позиция центра в процентах от размеров холста. */
export type Table = {
  id: string
  name: string
  /** 0..100 — доля ширины холста. */
  x: number
  /** 0..100 — доля высоты холста. */
  y: number
}

export type Hall = {
  /** Диаметр кружка стола, px. */
  tableSize: number
  tables: Table[]
}

export type SessionState =
  /** Этап идёт. */
  | 'running'
  /** Этап на паузе. */
  | 'paused'
  /** Этап истёк, ждём подтверждения мастера. */
  | 'awaiting'
  /** Программа отработала полностью, счётчик идёт вверх. */
  | 'overtime'

/** Кальян на столе — экземпляр запущенной программы. */
export type Session = {
  id: string
  tableId: string
  programId: string
  /** Порядковый номер кальяна на столе: «Кальян 1», «Кальян 2». */
  label: string
  /** Индекс текущего интервала в программе. */
  stageIndex: number
  /** Какой по счёту повтор текущего интервала идёт (0-based). */
  repeatIndex: number
  /** Абсолютное время старта текущего прохода, ms. */
  stageStartedAt: number
  /** Абсолютное время окончания текущего прохода, ms (сдвигается паузой и кнопкой «+5 мин»). */
  stageEndsAt: number
  state: SessionState
  /** Момент постановки на паузу, ms. */
  pausedAt: number | null
  /** С какого момента ждём действия мастера (awaiting/overtime), ms. */
  pendingSince: number | null
  /** Когда последний раз проиграли сигнал для текущего ожидания, ms. */
  lastAlertAt: number | null
  /** Начало всей сессии, ms. */
  startedAt: number
}

/** Запись в истории — закрытый кальян. */
export type HistoryEntry = {
  id: string
  tableId: string
  tableName: string
  programName: string
  startedAt: number
  closedAt: number
}

export type Settings = {
  soundEnabled: boolean
  notificationsEnabled: boolean
  /** Программа, которая стартует одним тапом. */
  defaultProgramId: string
  /** Как часто повторять сигнал, пока мастер не отреагировал, сек. */
  alertRepeatSec: number
}

export type AppState = {
  version: number
  hall: Hall
  programs: Program[]
  sessions: Session[]
  history: HistoryEntry[]
  settings: Settings
}
