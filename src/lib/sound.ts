let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Разблокировка звука — вызывается на первый жест пользователя. */
export function unlockAudio(): void {
  getCtx()
}

function beep(audio: AudioContext, freq: number, startAt: number, duration: number, gain: number) {
  const osc = audio.createOscillator()
  const vol = audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  vol.gain.setValueAtTime(0, startAt)
  vol.gain.linearRampToValueAtTime(gain, startAt + 0.02)
  vol.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(vol).connect(audio.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

/** Сигнал окончания этапа: три коротких удара. */
export function playStageAlert(): void {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  beep(audio, 880, t, 0.18, 0.35)
  beep(audio, 880, t + 0.24, 0.18, 0.35)
  beep(audio, 1170, t + 0.48, 0.3, 0.35)
}

/** Сигнал завершения кальяна: нисходящая фраза. */
export function playSessionEndAlert(): void {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  beep(audio, 1170, t, 0.2, 0.35)
  beep(audio, 880, t + 0.26, 0.2, 0.35)
  beep(audio, 660, t + 0.52, 0.45, 0.35)
}
