import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { formatDuration, formatTime } from '../lib/format'
import { notificationPermission, requestNotificationPermission } from '../lib/notify'

/** Смена считается с 6 утра — заведение работает за полночь. */
const SHIFT_START_HOUR = 6

export function shiftStart(now: number): number {
  const date = new Date(now)
  if (date.getHours() < SHIFT_START_HOUR) date.setDate(date.getDate() - 1)
  date.setHours(SHIFT_START_HOUR, 0, 0, 0)
  return date.getTime()
}

export function ShiftView() {
  const { state, now, actions } = useStore()
  const [resetArmed, setResetArmed] = useState(false)
  const from = shiftStart(now)

  const shiftHistory = useMemo(
    () => state.history.filter((h) => h.closedAt >= from),
    [state.history, from],
  )

  const byTable = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    for (const entry of shiftHistory) {
      const current = map.get(entry.tableId) ?? { name: entry.tableName, count: 0 }
      current.count += 1
      map.set(entry.tableId, current)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [shiftHistory])

  const avgSec = shiftHistory.length
    ? shiftHistory.reduce((sum, h) => sum + (h.closedAt - h.startedAt), 0) / shiftHistory.length / 1000
    : 0

  const permission = notificationPermission()

  const toggleNotifications = async () => {
    if (state.settings.notificationsEnabled) {
      actions.updateSettings({ notificationsEnabled: false })
      return
    }
    const granted = await requestNotificationPermission()
    actions.updateSettings({ notificationsEnabled: granted })
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Смена</h2>
        <p className="hint">С {formatTime(from)}, {new Date(from).toLocaleDateString('ru-RU')}</p>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{shiftHistory.length}</div>
          <div className="stat-label">кальянов отдано за смену</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{state.sessions.length}</div>
          <div className="stat-label">сейчас в работе</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avgSec ? formatDuration(avgSec) : '—'}</div>
          <div className="stat-label">среднее время кальяна</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {state.sessions.filter((s) => s.state === 'awaiting').length}
          </div>
          <div className="stat-label">ждут мастера прямо сейчас</div>
        </div>
      </div>

      <div className="programs-layout">
        <div className="panel">
          <h3 style={{ marginTop: 0, fontSize: 15 }}>По столам</h3>
          {byTable.length === 0 ? (
            <p className="hint">За смену пока ничего не закрыто.</p>
          ) : (
            <table className="data">
              <tbody>
                {byTable.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Последние закрытые</h3>
          {shiftHistory.length === 0 ? (
            <p className="hint">История появится после первого закрытого кальяна.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Стол</th>
                  <th>Программа</th>
                  <th>Начало</th>
                  <th>Закрыт</th>
                  <th>Длительность</th>
                </tr>
              </thead>
              <tbody>
                {shiftHistory.slice(0, 25).map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.tableName}</td>
                    <td>{entry.programName}</td>
                    <td>{formatTime(entry.startedAt)}</td>
                    <td>{formatTime(entry.closedAt)}</td>
                    <td>{formatDuration((entry.closedAt - entry.startedAt) / 1000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Настройки</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="field inline">
            <input
              type="checkbox"
              checked={state.settings.soundEnabled}
              onChange={(e) => actions.updateSettings({ soundEnabled: e.target.checked })}
            />
            <span>Звуковой сигнал</span>
          </label>

          <label className="field inline">
            <input
              type="checkbox"
              checked={state.settings.notificationsEnabled}
              onChange={toggleNotifications}
              disabled={permission === 'unsupported' || permission === 'denied'}
            />
            <span>
              Уведомления браузера
              {permission === 'denied' && ' — заблокированы в браузере'}
              {permission === 'unsupported' && ' — не поддерживаются'}
            </span>
          </label>

          <label className="field inline">
            <span>Повтор сигнала, сек</span>
            <input
              type="number"
              min={5}
              max={300}
              style={{ width: 90 }}
              value={state.settings.alertRepeatSec}
              onChange={(e) =>
                actions.updateSettings({
                  alertRepeatSec: Math.min(300, Math.max(5, Number(e.target.value) || 30)),
                })
              }
            />
          </label>

          <div className="topbar-spacer" />
          <button className="btn danger small" onClick={() => actions.clearHistory()}>
            Очистить историю
          </button>
          <button
            className={`btn small ${resetArmed ? 'danger' : ''}`}
            onClick={() => {
              if (resetArmed) {
                actions.resetAll()
                setResetArmed(false)
              } else {
                setResetArmed(true)
                window.setTimeout(() => setResetArmed(false), 4000)
              }
            }}
          >
            {resetArmed ? 'Точно сбросить всё?' : 'Сбросить всё'}
          </button>
        </div>
      </div>
    </div>
  )
}
