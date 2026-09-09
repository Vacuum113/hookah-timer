import { useStore } from '../store'
import { formatMinutes } from '../lib/format'

type Props = {
  title: string
  onPick: (programId: string) => void
  onClose: () => void
}

export function ProgramPicker({ title, onPick, onClose }: Props) {
  const { state } = useStore()

  return (
    <div
      className="overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {state.programs.map((program) => {
          const total = program.intervals.reduce(
            (sum, iv) => sum + iv.durationSec * Math.max(1, iv.repeat),
            0,
          )
          return (
            <button
              key={program.id}
              className="program-choice"
              onClick={() => onPick(program.id)}
            >
              <span className="swatch" style={{ background: program.color }} />
              <span>
                <strong>{program.name}</strong>
                <br />
                <span className="table-meta">
                  {program.intervals.map((iv) => iv.name).join(' → ') || 'нет интервалов'}
                </span>
              </span>
              <span className="sum">{formatMinutes(total)}</span>
            </button>
          )
        })}
        {state.programs.length === 0 && (
          <p className="hint">Программ пока нет — создайте их во вкладке «Программы».</p>
        )}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
