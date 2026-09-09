import type { ReactNode } from 'react'
import { useStore } from '../store'
import { formatMinutes } from '../lib/format'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="help-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

/** Мини-кружок для легенды состояний. */
function Swatch({ kind }: { kind: 'running' | 'soon' | 'waiting' | 'done' | 'free' }) {
  return <span className={`help-swatch ${kind}`} aria-hidden="true" />
}

export function HelpView({ onGoTo }: { onGoTo: (tab: 'tables' | 'programs') => void }) {
  const { state } = useStore()
  const program =
    state.programs.find((p) => p.id === state.settings.defaultProgramId) ?? state.programs[0]
  const total = program
    ? program.intervals.reduce((sum, iv) => sum + iv.durationSec * Math.max(1, iv.repeat), 0)
    : 0

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Как этим пользоваться</h2>
        <p className="hint">Короткая инструкция для мастера за баром и для управляющего.</p>
      </div>

      <div className="help-layout">
        <div>
          <Section title="С чего начать">
            <ol className="help-steps">
              <li>
                <strong>Расставьте столы.</strong> Вкладка «Столы» → «+ Стол», перетащите кружки
                так, как столы стоят в зале, переименуйте их и нажмите «Сохранить».
                <div className="help-actions">
                  <button className="btn small" onClick={() => onGoTo('tables')}>
                    Открыть расстановку
                  </button>
                </div>
              </li>
              <li>
                <strong>Проверьте программы.</strong> Вкладка «Программы» — это наборы интервалов
                (забивка, прогрев, работа чаши). Программа по умолчанию запускается одним тапом.
                <div className="help-actions">
                  <button className="btn small" onClick={() => onGoTo('programs')}>
                    Открыть программы
                  </button>
                </div>
              </li>
              <li>
                <strong>Работайте.</strong> Вкладка «Зал»: тап по столу — кальян пошёл.
              </li>
            </ol>
          </Section>

          <Section title="Запуск кальяна">
            <ul className="help-list">
              <li>
                <b>Короткий тап по свободному столу</b> — запускает программу по умолчанию
                {program && (
                  <>
                    {' '}
                    («{program.name}», {formatMinutes(total)})
                  </>
                )}
                .
              </li>
              <li>
                <b>Долгое нажатие</b> (полсекунды) — выбор другой программы, например фруктовой чаши.
              </li>
              <li>
                <b>Тап по занятому столу</b> — панель стола со всеми его кальянами и кнопками.
              </li>
              <li>
                <b>Несколько кальянов на один стол</b> — в панели стола кнопка «+ Кальян».
                На кружке появится значок «×2», а время показывается по самому срочному из них.
              </li>
            </ul>
          </Section>

          <Section title="Что делать по сигналу">
            <p className="hint" style={{ marginBottom: 10 }}>
              Когда этап заканчивается, звучит сигнал, кружок начинает мигать красным, а в шапке
              растёт счётчик «ждут мастера». Сигнал повторяется, пока стол не обслужили.
            </p>
            <ul className="help-list">
              <li>
                <b>Готово</b> — подтверждает, что вы обслужили стол, и запускает следующий этап.
                Пока не нажали, идёт счётчик просрочки — видно, сколько стол ждёт.
              </li>
              <li>
                <b>+5 мин</b> — продлить текущий этап (гости просят подольше, чаша ещё держит).
              </li>
              <li>
                <b>Пауза</b> — остановить отсчёт (гости вышли, кальян отставили).
              </li>
              <li>
                <b>Закрыть</b> — кальян отработал, стол освобождается и попадает в статистику смены.
                Досрочное закрытие спрашивает подтверждение, чтобы не сбросить случайно.
              </li>
            </ul>
          </Section>
        </div>

        <div>
          <Section title="Цвета кружка">
            <ul className="help-legend">
              <li>
                <Swatch kind="free" /> <span>Стол свободен — тап запускает кальян</span>
              </li>
              <li>
                <Swatch kind="running" /> <span>Этап идёт, кольцо показывает прогресс</span>
              </li>
              <li>
                <Swatch kind="soon" /> <span>Осталась меньше минуты — готовьтесь подойти</span>
              </li>
              <li>
                <Swatch kind="waiting" /> <span>Ждёт мастера: этап закончился, нужно «Готово»</span>
              </li>
              <li>
                <Swatch kind="done" /> <span>Кальян отработал — можно закрывать стол</span>
              </li>
            </ul>
          </Section>

          <Section title="Настройка программ">
            <ul className="help-list">
              <li>
                <b>Минут</b> — длительность этапа.
              </li>
              <li>
                <b>Повторов</b> — цикличный этап: «уголь каждые 20 мин × 3» просигналит три раза
                подряд внутри одного этапа.
              </li>
              <li>
                <b>Авто / ждать мастера</b> — переходить к следующему этапу самому или встать
                и сигналить, пока мастер не подтвердит. Забивку и уголь обычно ставят на
                «ждать мастера», прогрев — на «авто».
              </li>
              <li>Программ может быть несколько — у каждой свой цвет кольца на кружке.</li>
            </ul>
          </Section>

          <Section title="Смена и настройки">
            <ul className="help-list">
              <li>
                Вкладка «Смена» — сколько кальянов отдано, сколько в работе, среднее время
                и разбивка по столам. Смена считается с 6 утра.
              </li>
              <li>Там же включается звук, уведомления браузера и частота повтора сигнала.</li>
              <li>
                «Сбросить всё» вернёт приложение к заводскому состоянию — столы и программы
                придётся настроить заново.
              </li>
            </ul>
          </Section>

          <Section title="Важно знать">
            <ul className="help-list">
              <li>
                Данные хранятся <b>в браузере конкретного устройства</b>. Планшет за баром и телефон
                мастера — это две независимые копии, они не видят таймеры друг друга.
              </li>
              <li>
                Таймеры считаются по реальному времени: перезагрузка страницы, спящий экран или
                закрытая вкладка их не сбивают.
              </li>
              <li>
                Если открыть приложение в двух вкладках одного браузера, они синхронизируются.
              </li>
              <li>
                На планшете удобно добавить страницу на домашний экран — откроется как приложение,
                без адресной строки.
              </li>
              <li>Чистка данных браузера сотрёт раскладку столов и историю смен.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}
