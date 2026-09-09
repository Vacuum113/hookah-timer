import { useMemo, useRef, useState } from 'react'
import type { Interval, Program } from '../types'
import { useStore } from '../store'
import { uid } from '../lib/id'
import { formatMinutes } from '../lib/format'
import { PROGRAM_COLORS } from '../lib/defaults'

export function ProgramsEditor({ onDone }: { onDone: () => void }) {
  const { state, actions } = useStore()
  const [programs, setPrograms] = useState<Program[]>(() => structuredClone(state.programs))
  const [defaultId, setDefaultId] = useState(state.settings.defaultProgramId)
  const [selectedId, setSelectedId] = useState(state.programs[0]?.id ?? '')
  const [warning, setWarning] = useState<string | null>(null)
  const removalConfirmed = useRef(false)

  const selected = programs.find((p) => p.id === selectedId) ?? null
  const dirty = useMemo(
    () =>
      JSON.stringify(programs) !== JSON.stringify(state.programs) ||
      defaultId !== state.settings.defaultProgramId,
    [programs, defaultId, state.programs, state.settings.defaultProgramId],
  )

  const patchProgram = (id: string, patch: Partial<Program>) =>
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const patchInterval = (programId: string, intervalId: string, patch: Partial<Interval>) =>
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === programId
          ? {
              ...p,
              intervals: p.intervals.map((iv) => (iv.id === intervalId ? { ...iv, ...patch } : iv)),
            }
          : p,
      ),
    )

  const addProgram = () => {
    const program: Program = {
      id: uid('prog-'),
      name: `Программа ${programs.length + 1}`,
      color: PROGRAM_COLORS[programs.length % PROGRAM_COLORS.length],
      intervals: [
        { id: uid('int-'), name: 'Забивка', durationSec: 15 * 60, autoNext: false, repeat: 1 },
      ],
    }
    setPrograms((prev) => [...prev, program])
    setSelectedId(program.id)
  }

  const removeProgram = (id: string) => {
    setPrograms((prev) => prev.filter((p) => p.id !== id))
    if (defaultId === id) {
      const fallback = programs.find((p) => p.id !== id)
      setDefaultId(fallback?.id ?? '')
    }
    setSelectedId((prev) => (prev === id ? (programs.find((p) => p.id !== id)?.id ?? '') : prev))
  }

  const addInterval = (programId: string) =>
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === programId
          ? {
              ...p,
              intervals: [
                ...p.intervals,
                { id: uid('int-'), name: 'Новый этап', durationSec: 10 * 60, autoNext: true, repeat: 1 },
              ],
            }
          : p,
      ),
    )

  const removeInterval = (programId: string, intervalId: string) =>
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === programId
          ? { ...p, intervals: p.intervals.filter((iv) => iv.id !== intervalId) }
          : p,
      ),
    )

  const moveInterval = (programId: string, index: number, delta: number) =>
    setPrograms((prev) =>
      prev.map((p) => {
        if (p.id !== programId) return p
        const target = index + delta
        if (target < 0 || target >= p.intervals.length) return p
        const intervals = [...p.intervals]
        const [item] = intervals.splice(index, 1)
        intervals.splice(target, 0, item)
        return { ...p, intervals }
      }),
    )

  const save = () => {
    const removed = state.programs.filter((p) => !programs.some((x) => x.id === p.id))
    const affected = state.sessions.filter((s) => removed.some((p) => p.id === s.programId))
    if (affected.length > 0 && !removalConfirmed.current) {
      removalConfirmed.current = true
      setWarning(
        `Удаляемые программы используются в ${affected.length} активных кальянах — они станут отработавшими. Нажмите «Сохранить» ещё раз для подтверждения.`,
      )
      return
    }
    actions.savePrograms(programs, defaultId)
    onDone()
  }

  const total = (program: Program) =>
    program.intervals.reduce((sum, iv) => sum + iv.durationSec * Math.max(1, iv.repeat), 0)

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Программы</h2>
        <p className="hint">Наборы интервалов. Программа по умолчанию запускается одним тапом.</p>
        <div className="topbar-spacer" />
        <button className="btn ghost" onClick={onDone}>
          Отмена
        </button>
        <button className="btn primary" onClick={save} disabled={!dirty}>
          Сохранить
        </button>
      </div>

      {warning && <p className="hint" style={{ color: '#ff9a8a', marginBottom: 10 }}>{warning}</p>}

      <div className="programs-layout">
        <div>
          <div className="program-list">
            {programs.map((program) => (
              <button
                key={program.id}
                className="program-item"
                aria-current={program.id === selectedId}
                onClick={() => setSelectedId(program.id)}
              >
                <span className="swatch" style={{ background: program.color }} />
                <span>
                  {program.name}
                  <br />
                  <span className="table-meta">{formatMinutes(total(program))}</span>
                </span>
                {program.id === defaultId && <span className="default-mark">по умолч.</span>}
              </button>
            ))}
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={addProgram}>
            + Программа
          </button>
        </div>

        {selected ? (
          <div className="panel">
            <div className="page-head">
              <div className="field">
                <span>Название программы</span>
                <input
                  value={selected.name}
                  onChange={(e) => patchProgram(selected.id, { name: e.target.value })}
                />
              </div>
              <div className="field">
                <span>Цвет</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {PROGRAM_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => patchProgram(selected.id, { color })}
                      aria-label={`Цвет ${color}`}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: color,
                        outline: selected.color === color ? '2px solid #fff' : 'none',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="topbar-spacer" />
              <button
                className="btn small"
                disabled={defaultId === selected.id}
                onClick={() => setDefaultId(selected.id)}
              >
                Сделать основной
              </button>
              <button
                className="btn danger small"
                disabled={programs.length <= 1}
                onClick={() => removeProgram(selected.id)}
              >
                Удалить
              </button>
            </div>

            <div className="interval-head">
              <span>Этап</span>
              <span>Минут</span>
              <span>Повторов</span>
              <span>Переход</span>
              <span />
            </div>

            {selected.intervals.map((interval, index) => (
              <div className="interval-row" key={interval.id}>
                <input
                  value={interval.name}
                  onChange={(e) => patchInterval(selected.id, interval.id, { name: e.target.value })}
                />
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={Math.round(interval.durationSec / 60)}
                  onChange={(e) =>
                    patchInterval(selected.id, interval.id, {
                      durationSec: Math.max(1, Number(e.target.value) || 1) * 60,
                    })
                  }
                />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={interval.repeat}
                  onChange={(e) =>
                    patchInterval(selected.id, interval.id, {
                      repeat: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                />
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={interval.autoNext}
                    onChange={(e) =>
                      patchInterval(selected.id, interval.id, { autoNext: e.target.checked })
                    }
                  />
                  {interval.autoNext ? 'авто' : 'ждать мастера'}
                </label>
                <span className="row-actions" style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn small"
                    onClick={() => moveInterval(selected.id, index, -1)}
                    aria-label="Выше"
                  >
                    ↑
                  </button>
                  <button
                    className="btn small"
                    onClick={() => moveInterval(selected.id, index, 1)}
                    aria-label="Ниже"
                  >
                    ↓
                  </button>
                  <button
                    className="btn danger small"
                    onClick={() => removeInterval(selected.id, interval.id)}
                    aria-label="Удалить этап"
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}

            <button className="btn" onClick={() => addInterval(selected.id)}>
              + Интервал
            </button>

            <p className="hint" style={{ marginTop: 10 }}>
              Итого {formatMinutes(total(selected))}. «Ждать мастера» — таймер встанет и будет
              сигналить, пока не подтвердят. Повторы — цикличный этап, например «уголь каждые 20 мин × 3».
            </p>
          </div>
        ) : (
          <div className="panel">
            <p className="hint">Выберите программу слева или создайте новую.</p>
          </div>
        )}
      </div>
    </div>
  )
}
