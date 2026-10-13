import { apiFetch } from '../lib/api'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Credenciales incorrectas.'); return }
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch { setError('No se pudo conectar con el servidor. Intenta nuevamente cuando esté disponible.') }
    finally { setLoading(false) }
  }
  return (
    <div className="login-page">
      <section className="login-story" aria-label="Taller Pedro Espinoza">
        <div className="brand"><span className="brand-mark">E<span>.</span></span><span><strong>ESPINOZA</strong><small>TALLER AUTOMOTRIZ</small></span></div>
        <div><span className="eyebrow">PRECISIÓN EN CADA DETALLE</span><h1>Un gran taller.<br/>Una gestión<br/><em>a su altura.</em></h1><p>De la recepción a la entrega. Tu equipo, tus órdenes y cada reparación, en un solo lugar.</p></div>
        <footer>TALLER PEDRO ESPINOZA · GESTIÓN AUTOMOTRIZ</footer>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <span className="eyebrow">BIENVENIDO A TU TALLER</span><h2>Todo listo para empezar.</h2><p>Ingresa con tu cuenta para continuar.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <div><label htmlFor="email">Correo electrónico</label><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@taller.com" required autoComplete="username"/></div>
            <div><label htmlFor="password">Contraseña</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Ingresa tu contraseña" required autoComplete="current-password"/></div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button type="submit" className="btn-cyber-orange" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar al taller →'}</button>
            {import.meta.env.DEV && <button className="demo-button" type="button" onClick={() => { setEmail('admin@tallerespinoza.com'); setPassword('admin1234') }}>Cargar cuenta de prueba · Entorno local</button>}
          </form>
          <div className="login-footnote">Acceso para el personal de Taller Pedro Espinoza.</div>
        </div>
      </section>
    </div>
  )
}


