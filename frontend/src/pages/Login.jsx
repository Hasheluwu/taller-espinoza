import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import './Login.css'
import WorkshopBackdrop from '../components/WorkshopBackdrop'

function ToolMark({ className = '' }) {
  return <svg className={className} viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M49 9a21 21 0 0 0-23 27L9 53a12 12 0 0 0 18 18l17-17A21 21 0 0 0 71 31L57 44 43 37l-7-14Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><circle cx="19" cy="61" r="4" stroke="currentColor" strokeWidth="3"/></svg>
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  const [showPassword, setShowPassword] = useState(false)
  const [sound, setSound] = useState(true)
  const audio = useRef(null)
  const redirect = useRef(null)
  const submitting = useRef(false)
  const mounted = useRef(true)
  const cardFrame = useRef(null)
  const pointerFrame = useRef(0)
  const navigate = useNavigate()
  const busy = status === 'loading' || status === 'success'

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(redirect.current)
      cancelAnimationFrame(pointerFrame.current)
      if (audio.current) void audio.current.close().catch(() => {})
      audio.current = null
    }
  }, [])

  function followPointer(event) {
    if (event.pointerType !== 'mouse' || pointerFrame.current) return
    const frame = cardFrame.current
    if (!frame) return
    const { clientX, clientY } = event
    pointerFrame.current = requestAnimationFrame(() => {
      pointerFrame.current = 0
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const bounds = frame.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width))
      const y = Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height))
      frame.style.setProperty('--pointer-x', `${x * 100}%`)
      frame.style.setProperty('--pointer-y', `${y * 100}%`)
      frame.style.setProperty('--tilt-x', `${(0.5 - y) * 5}deg`)
      frame.style.setProperty('--tilt-y', `${(x - 0.5) * 6}deg`)
    })
  }

  function resetPointer() {
    cancelAnimationFrame(pointerFrame.current)
    pointerFrame.current = 0
    const frame = cardFrame.current
    if (!frame) return
    for (const property of ['--pointer-x', '--pointer-y', '--tilt-x', '--tilt-y']) frame.style.removeProperty(property)
  }

  // Unlock audio during the user's click; audio failures never interrupt login.
  function prepareAudio() {
    if (!sound) return
    try {
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!Audio) return
      audio.current ??= new Audio()
      void audio.current.resume().catch(() => {})
    } catch { /* Audio is optional on unsupported browsers. */ }
  }

  function playFeedback(success) {
    const context = audio.current
    if (!sound || !context || context.state !== 'running') return
    try {
      const tones = success ? [660, 990] : [240, 180]
      tones.forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const start = context.currentTime + index * .13
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(.085, start + .015)
        gain.gain.exponentialRampToValueAtTime(.001, start + .24)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
        oscillator.start(start)
        oscillator.stop(start + .25)
      })
    } catch { /* Visual feedback remains available when sound cannot play. */ }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    prepareAudio()
    setError('')
    setStatus('loading')
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await response.json()
      if (!mounted.current) return
      if (!response.ok) throw new Error(data.message || 'Correo o contraseña incorrectos. Inténtalo de nuevo.')
      if (!data.token || typeof data.token !== 'string') throw new Error('No se pudo validar el acceso. Inténtalo de nuevo.')
      localStorage.setItem('token', data.token)
      setStatus('success')
      playFeedback(true)
      redirect.current = setTimeout(() => navigate('/dashboard', { replace: true }), 650)
    } catch (failure) {
      if (!mounted.current) return
      setError(failure.message || 'No se pudo conectar con el servidor. Inténtalo de nuevo.')
      setStatus('error')
      submitting.current = false
      playFeedback(false)
    }
  }

  return (
    <main className="ignition-login">
      <WorkshopBackdrop/>
      <header className="ignition-header">
        <div className="ignition-brand"><img className="ignition-logo" src="/images/logo-taller-espinoza.png" alt="" width="46" height="48"/><span><strong>ESPINOZA</strong><small>TALLER AUTOMOTRIZ</small></span></div>
        <button type="button" className="ignition-sound" aria-label={sound ? 'Desactivar sonidos' : 'Activar sonidos'} aria-pressed={sound} onClick={() => setSound(value => !value)} disabled={busy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M11 5 6 9H3v6l5 4Z"/>{sound ? <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/> : <path d="m16 9 6 6m0-6-6 6"/>}</svg>
          <span>Sonido {sound ? 'activado' : 'desactivado'}</span>
        </button>
      </header>
      <div className="ignition-stage">
        <div className="ignition-card-entry">
          <div className="ignition-interactive" ref={cardFrame} onPointerMove={followPointer} onPointerLeave={resetPointer} onPointerCancel={resetPointer}>
          <div className="ignition-halo" aria-hidden="true"/>
          <section className={`ignition-card is-${status}`} aria-labelledby="login-heading">
            <div className="ignition-card-sheen" aria-hidden="true"/>
            <div className="ignition-card-top"><span><i/> TU ESPACIO DE TRABAJO</span><ToolMark/></div>
            <div className="ignition-intro"><img className="ignition-card-logo" src="/images/logo-taller-espinoza.png" alt="Logo Taller Espinoza, pintura automotriz" width="104" height="109"/><h1 id="login-heading">Todo listo.<br/>Entra al taller<span>.</span></h1><p>El control de tu taller empieza aquí.</p></div>
            <form onSubmit={handleSubmit} className="ignition-form" aria-busy={busy}>
              <div className="ignition-field ignition-step-one">
                <label htmlFor="email">Correo electrónico</label>
                <div className="ignition-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg><input id="email" type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@taller.com" required autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy} aria-describedby={error ? 'login-error' : undefined}/></div>
              </div>
              <div className="ignition-field ignition-step-two">
                <label htmlFor="password">Contraseña</label>
                <div className="ignition-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="password" maxLength={1024} type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Escribe tu contraseña" required autoComplete="current-password" disabled={busy} aria-describedby={error ? 'login-error' : undefined}/>
                  <button type="button" className="ignition-reveal" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword && <path d="m3 3 18 18"/>}</svg></button>
                </div>
              </div>
              {error && <div id="login-error" className="ignition-error" role="alert">{error}</div>}
              <button type="submit" className="ignition-submit ignition-step-three" disabled={busy}><span>{status === 'success' ? 'Acceso correcto' : status === 'loading' ? 'Verificando acceso…' : 'Ingresar al taller'}</span>{status === 'loading' ? <span className="ignition-spinner" aria-hidden="true"/> : <span aria-hidden="true">{status === 'success' ? '✓' : '↗'}</span>}</button>
              <div className="ignition-status" role="status">{status === 'success' ? 'Bienvenido. Abriendo tu espacio de trabajo…' : ''}</div>
              {import.meta.env.DEV && import.meta.env.VITE_DEMO_EMAIL && import.meta.env.VITE_DEMO_PASSWORD && <button className="ignition-demo" type="button" disabled={busy} onClick={() => { setEmail(import.meta.env.VITE_DEMO_EMAIL); setPassword(import.meta.env.VITE_DEMO_PASSWORD); setError(''); setStatus('idle') }}>Usar cuenta de prueba <span>Desarrollo</span></button>}
            </form>
            <div className="ignition-help">¿Necesitas acceso?<br/><span>Contacta a la administración del taller.</span></div>
          </section>
          </div>
          <p className="ignition-exclusive">ACCESO EXCLUSIVO PARA EL EQUIPO</p>
        </div>
      </div>
      <footer className="ignition-footer"><span>Pedro Espinoza <span className="ignition-footer-divider">/</span> Cada detalle cuenta.</span><span>Pintura <i/> Enderezado <i/> Mecánica</span></footer>
    </main>
  )
}
