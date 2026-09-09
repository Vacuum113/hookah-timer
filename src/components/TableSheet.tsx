import { useState } from 'react'
import { useStore } from '../store'
import { SessionCard } from './SessionCard'
import { ProgramPicker } from './ProgramPicker'

export function TableSheet({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const { state, actions } = useStore()
  const [picking, setPicking] = useState(false)
  const table = state.hall.tables.find((t) => t.id === tableId)
  const sessions = state.sessions.filter((s) => s.tableId === tableId)

  if (!table) return null

  const start = (programId?: string) => {
    actions.startSession(table.id, programId)
    setPicking(false)
  }

  if (picking) {
    return (
      <ProgramPicker
        title={`${table.name}: какую программу запустить?`}
        onPick={start}
        onClose={() => setPicking(false)}
      />
    )
  }

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>
          {table.name}
          {sessions.length > 0 && <span className="table-meta"> · {sessions.length} кальян(а)</span>}
        </h3>

        <div className="sheet-tables">
          {sessions.map((session) => {
            const program = state.programs.find((p) => p.id === session.programId)
            if (!program) return null
            return <SessionCard key={session.id} session={session} program={program} />
          })}
          {sessions.length === 0 && <p className="hint">Стол свободен.</p>}
        </div>

        <div className="sheet-actions">
          <button className="btn primary" onClick={() => start()}>
            + Кальян
          </button>
          <button className="btn" onClick={() => setPicking(true)}>
            Другая программа
          </button>
          <div className="topbar-spacer" />
          <button className="btn ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
