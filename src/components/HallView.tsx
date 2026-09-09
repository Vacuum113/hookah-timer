import { useRef, useState } from 'react'
import { useStore } from '../store'
import { TableBubble } from './TableBubble'
import { TableSheet } from './TableSheet'
import { ProgramPicker } from './ProgramPicker'
import { useIsNarrow } from '../lib/useIsNarrow'

/** Долгое нажатие на свободном столе открывает выбор программы. */
const LONG_PRESS_MS = 450

export function HallView({ onEditHall }: { onEditHall: () => void }) {
  const { state, now, actions } = useStore()
  const [sheetTableId, setSheetTableId] = useState<string | null>(null)
  const [pickerTableId, setPickerTableId] = useState<string | null>(null)
  const longPress = useRef<{ timer: number; fired: boolean } | null>(null)
  const narrow = useIsNarrow()

  const startLongPress = (tableId: string) => {
    const timer = window.setTimeout(() => {
      if (longPress.current) longPress.current.fired = true
      setPickerTableId(tableId)
    }, LONG_PRESS_MS)
    longPress.current = { timer, fired: false }
  }

  const cancelLongPress = () => {
    if (longPress.current) window.clearTimeout(longPress.current.timer)
  }

  const handleClick = (tableId: string, busy: boolean) => {
    if (longPress.current?.fired) {
      longPress.current = null
      return
    }
    // Свободный стол запускается одним тапом, занятый открывает панель.
    if (busy) setSheetTableId(tableId)
    else actions.startSession(tableId)
  }

  if (state.hall.tables.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>Зал пока пустой</h2>
          <p style={{ maxWidth: 420, margin: '0 auto 16px' }}>
            Добавьте столы и расставьте их по экрану так, как они стоят в заведении, —
            дальше кальяны запускаются одним тапом по столу.
          </p>
          <button className="btn primary" onClick={onEditHall}>
            Расставить столы
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className={`hall-canvas ${narrow ? 'flow' : ''}`}>
        {state.hall.tables.map((table) => {
          const sessions = state.sessions.filter((s) => s.tableId === table.id)
          return (
            <TableBubble
              key={table.id}
              table={table}
              sessions={sessions}
              programs={state.programs}
              size={state.hall.tableSize}
              now={now}
              positioned={!narrow}
              onPointerDown={() => startLongPress(table.id)}
              onClick={() => {
                cancelLongPress()
                handleClick(table.id, sessions.length > 0)
              }}
            />
          )
        })}
      </div>

      {sheetTableId && (
        <TableSheet tableId={sheetTableId} onClose={() => setSheetTableId(null)} />
      )}

      {pickerTableId && (
        <ProgramPicker
          title={`${state.hall.tables.find((t) => t.id === pickerTableId)?.name ?? 'Стол'}: какую программу запустить?`}
          onPick={(programId) => {
            actions.startSession(pickerTableId, programId)
            setPickerTableId(null)
          }}
          onClose={() => setPickerTableId(null)}
        />
      )}
    </div>
  )
}
