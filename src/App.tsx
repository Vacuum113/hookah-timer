import { useEffect, useState } from 'react'
import { HallView } from './components/HallView'
import { HallEditor } from './components/HallEditor'
import { ProgramsEditor } from './components/ProgramsEditor'
import { ShiftView } from './components/ShiftView'
import { useStore } from './store'
import { unlockAudio } from './lib/sound'

type Tab = 'hall' | 'tables' | 'programs' | 'shift'

const TABS: { id: Tab; label: string }[] = [
  { id: 'hall', label: 'Зал' },
  { id: 'tables', label: 'Столы' },
  { id: 'programs', label: 'Программы' },
  { id: 'shift', label: 'Смена' },
]

export function App() {
  const { state, actions } = useStore()
  const [tab, setTab] = useState<Tab>('hall')

  // Браузеры разрешают звук только после жеста пользователя.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const waiting = state.sessions.filter((s) => s.state === 'awaiting').length
  const finished = state.sessions.filter((s) => s.state === 'overtime').length
  const attention = waiting + finished

  useEffect(() => {
    document.title = attention ? `(${attention}) Кальянные таймеры` : 'Кальянные таймеры'
  }, [attention])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Кальянные <span>таймеры</span>
        </div>
        <nav className="tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              className="tab"
              aria-current={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="topbar-spacer" />
        <div className={`attention-pill ${attention ? '' : 'calm'}`}>
          {attention ? (
            <>
              ● {waiting > 0 && `${waiting} ждут мастера`}
              {waiting > 0 && finished > 0 && ' · '}
              {finished > 0 && `${finished} отработали`}
            </>
          ) : (
            <>● Все столы под контролем</>
          )}
        </div>
        <button
          className={`icon-btn ${state.settings.soundEnabled ? '' : 'off'}`}
          onClick={() => actions.updateSettings({ soundEnabled: !state.settings.soundEnabled })}
          title={state.settings.soundEnabled ? 'Выключить звук' : 'Включить звук'}
          aria-label={state.settings.soundEnabled ? 'Выключить звук' : 'Включить звук'}
        >
          {state.settings.soundEnabled ? '🔔' : '🔕'}
        </button>
      </header>

      {tab === 'hall' && <HallView onEditHall={() => setTab('tables')} />}
      {tab === 'tables' && <HallEditor onDone={() => setTab('hall')} />}
      {tab === 'programs' && <ProgramsEditor onDone={() => setTab('hall')} />}
      {tab === 'shift' && <ShiftView />}
    </div>
  )
}
