import { useMemo, useRef, useState } from 'react'
import type { Hall, Table } from '../types'
import { useStore } from '../store'
import { uid } from '../lib/id'
import { TableBubble } from './TableBubble'
import { useIsNarrow } from '../lib/useIsNarrow'

/** Шаг привязки при перетаскивании, px. */
const SNAP_PX = 20

export function HallEditor({ onDone }: { onDone: () => void }) {
  const { state, now, actions } = useStore()
  const [hall, setHall] = useState<Hall>(() => structuredClone(state.hall))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [snap, setSnap] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const grabOffset = useRef({ dx: 0, dy: 0 })
  const removalConfirmed = useRef(false)
  const narrow = useIsNarrow()

  const selected = hall.tables.find((t) => t.id === selectedId) ?? null
  const dirty = useMemo(
    () => JSON.stringify(hall) !== JSON.stringify(state.hall),
    [hall, state.hall],
  )

  const patchTable = (id: string, patch: Partial<Table>) =>
    setHall((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))

  const onPointerDown = (e: React.PointerEvent, table: Table) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setSelectedId(table.id)
    setDraggingId(table.id)
    grabOffset.current = {
      dx: e.clientX - (rect.left + (table.x / 100) * rect.width),
      dy: e.clientY - (rect.top + (table.y / 100) * rect.height),
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingId) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    let px = e.clientX - grabOffset.current.dx - rect.left
    let py = e.clientY - grabOffset.current.dy - rect.top
    if (snap) {
      px = Math.round(px / SNAP_PX) * SNAP_PX
      py = Math.round(py / SNAP_PX) * SNAP_PX
    }
    // Кружок не должен вылезать за пределы холста.
    const half = hall.tableSize / 2
    px = Math.min(rect.width - half, Math.max(half, px))
    py = Math.min(rect.height - half, Math.max(half, py))
    patchTable(draggingId, { x: (px / rect.width) * 100, y: (py / rect.height) * 100 })
  }

  const endDrag = () => setDraggingId(null)

  /** Ищет ближайшее свободное место, чтобы новые столы не ложились друг на друга. */
  const freeSpot = (tables: Table[]): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return { x: 50, y: 50 }
    const stepX = ((hall.tableSize + 16) / rect.width) * 100
    const stepY = ((hall.tableSize + 16) / rect.height) * 100
    const occupied = (x: number, y: number) =>
      tables.some(
        (t) =>
          Math.abs(((t.x - x) / 100) * rect.width) < hall.tableSize + 8 &&
          Math.abs(((t.y - y) / 100) * rect.height) < hall.tableSize + 8,
      )
    for (let y = stepY / 2; y <= 100 - stepY / 2 + 0.001; y += stepY) {
      for (let x = stepX / 2; x <= 100 - stepX / 2 + 0.001; x += stepX) {
        if (!occupied(x, y)) return { x, y }
      }
    }
    return { x: 50, y: 50 }
  }

  const addTable = () => {
    setHall((prev) => {
      const spot = freeSpot(prev.tables)
      const table: Table = {
        id: uid('tbl-'),
        name: `Стол ${prev.tables.length + 1}`,
        x: spot.x,
        y: spot.y,
      }
      setSelectedId(table.id)
      return { ...prev, tables: [...prev.tables, table] }
    })
  }

  const removeTable = (id: string) => {
    setHall((prev) => ({ ...prev, tables: prev.tables.filter((t) => t.id !== id) }))
    setSelectedId(null)
  }

  /** Раскладывает столы ровной сеткой — быстрый старт вместо ручной расстановки. */
  const autoArrange = () => {
    setHall((prev) => {
      const count = prev.tables.length
      if (count === 0) return prev
      const cols = Math.ceil(Math.sqrt(count))
      const rows = Math.ceil(count / cols)
      return {
        ...prev,
        tables: prev.tables.map((table, i) => ({
          ...table,
          x: ((Math.floor(i % cols) + 0.5) / cols) * 100,
          y: ((Math.floor(i / cols) + 0.5) / rows) * 100,
        })),
      }
    })
  }

  const save = () => {
    const removed = state.hall.tables.filter((t) => !hall.tables.some((x) => x.id === t.id))
    const lostSessions = state.sessions.filter((s) => removed.some((t) => t.id === s.tableId))
    if (lostSessions.length > 0 && !removalConfirmed.current) {
      removalConfirmed.current = true
      setWarning(
        `На удалённых столах есть активные кальяны (${lostSessions.length}). Нажмите «Сохранить» ещё раз, чтобы подтвердить.`,
      )
      return
    }
    actions.saveHall(hall)
    onDone()
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-head">
        <h2 className="page-title">Расстановка столов</h2>
        <p className="hint">
          Перетаскивайте кружки по экрану. Изменения применятся после сохранения.
        </p>
        <div className="topbar-spacer" />
        <button className="btn ghost" onClick={onDone}>
          Отмена
        </button>
        <button className="btn primary" onClick={save} disabled={!dirty}>
          Сохранить
        </button>
      </div>

      <div className="editor-toolbar">
        <button className="btn" onClick={addTable}>
          + Стол
        </button>
        <button className="btn" onClick={autoArrange}>
          Разложить сеткой
        </button>
        <label className="field inline">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          <span>Привязка</span>
        </label>
        <label className="field inline">
          <span>Размер</span>
          <input
            type="range"
            min={80}
            max={220}
            step={4}
            value={hall.tableSize}
            onChange={(e) => setHall((prev) => ({ ...prev, tableSize: Number(e.target.value) }))}
          />
          <span>{hall.tableSize} px</span>
        </label>

        {selected ? (
          <>
            <label className="field inline">
              <span>Название</span>
              <input
                value={selected.name}
                onChange={(e) => patchTable(selected.id, { name: e.target.value })}
                style={{ width: 150 }}
              />
            </label>
            <button className="btn danger small" onClick={() => removeTable(selected.id)}>
              Удалить стол
            </button>
          </>
        ) : (
          <span className="hint">Нажмите на стол, чтобы переименовать или удалить</span>
        )}
      </div>

      {warning && <p className="hint" style={{ color: '#ff9a8a', marginBottom: 10 }}>{warning}</p>}
      {narrow && (
        <p className="hint" style={{ marginBottom: 10 }}>
          На узком экране столы показываются потоком, но раскладка сохраняется для больших экранов.
        </p>
      )}

      <div
        ref={canvasRef}
        className={`hall-canvas editing ${narrow ? 'flow' : ''}`}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {hall.tables.length === 0 && (
          <div className="empty-state" style={{ margin: 'auto' }}>
            <p>Зал пустой. Добавьте столы и расставьте их так, как они стоят в заведении.</p>
            <button className="btn primary" onClick={addTable}>
              + Первый стол
            </button>
          </div>
        )}
        {hall.tables.map((table) => (
          <TableBubble
            key={table.id}
            table={table}
            sessions={state.sessions.filter((s) => s.tableId === table.id)}
            programs={state.programs}
            size={hall.tableSize}
            now={now}
            editing
            positioned={!narrow}
            selected={selectedId === table.id}
            dragging={draggingId === table.id}
            onPointerDown={(e) => onPointerDown(e, table)}
            onClick={() => setSelectedId(table.id)}
          />
        ))}
      </div>
    </div>
  )
}
