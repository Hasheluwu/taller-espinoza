import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res  = await fetch('http://localhost:3001/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Credenciales incorrectas.')
        return
      }

      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Cabecera */}
        <div style={styles.header}>
          <span style={styles.eyebrow}>Sistema de gestión</span>
          <h1 style={styles.title}>
            Taller <span style={styles.accent}>Pedro</span>{' '}
            <span style={styles.accent}>Espinoza</span>
          </h1>
          <p style={styles.subtitle}>Acceso restringido al personal autorizado.</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={styles.form} noValidate>

          <div style={styles.field}>
            <label style={styles.label}>
              <span style={styles.labelAccent}>Correo</span> electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@taller.com"
              required
              autoComplete="email"
              style={styles.input}
              onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, styles.input)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              <span style={styles.labelAccent}>Contraseña</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={styles.input}
              onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, styles.input)}
            />
          </div>

          {error && (
            <p style={styles.errorMsg}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={loading ? { ...styles.btn, ...styles.btnDisabled } : styles.btn}
          >
            {loading ? 'Verificando...' : 'Ingresar al sistema'}
          </button>

        </form>

        <p style={styles.footer}>
          Solo usuarios con cuenta registrada pueden acceder.
        </p>

      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Estilos en objeto — usan las variables CSS
   definidas en index.css
   ────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight:       '100vh',
    backgroundColor: 'var(--background)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         '1.5rem',
  },

  card: {
    width:           '100%',
    maxWidth:        '380px',
    backgroundColor: 'var(--surface)',
    border:          '1px solid var(--border)',
    borderRadius:    'var(--radius-xl)',
    padding:         '2.5rem 2rem',
    display:         'flex',
    flexDirection:   'column',
    gap:             '2rem',
    boxShadow:       'var(--shadow-lg)',
  },

  header: {
    display:        'flex',
    flexDirection:  'column',
    gap:            '0.4rem',
  },

  eyebrow: {
    fontSize:      'var(--text-xs)',
    fontWeight:    'var(--weight-medium)',
    color:         'var(--neutral-300)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },

  title: {
    fontSize:   'var(--text-subtitle)',
    fontWeight: 'var(--weight-bold)',
    color:      'var(--foreground)',
    lineHeight: 1.2,
    margin:     0,
  },

  accent: {
    color: 'var(--yellow-500)',
  },

  subtitle: {
    fontSize:   'var(--text-small)',
    color:      'var(--text-tertiary)',
    marginTop:  '0.25rem',
  },

  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '1.25rem',
  },

  field: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.4rem',
  },

  label: {
    fontSize:   'var(--text-small)',
    color:      'var(--neutral-200)',
    fontWeight: 'var(--weight-medium)',
  },

  labelAccent: {
    color:      'var(--yellow-400)',
    fontWeight: 'var(--weight-bold)',
  },

  input: {
    backgroundColor: 'var(--surface-raised)',
    border:          '1px solid var(--border)',
    color:           'var(--foreground)',
    borderRadius:    'var(--radius-md)',
    padding:         '0.65rem 0.875rem',
    fontSize:        'var(--text-body)',
    outline:         'none',
    width:           '100%',
    transition:      'border-color 0.15s, box-shadow 0.15s',
  },

  inputFocus: {
    backgroundColor: 'var(--surface-raised)',
    border:          '1px solid var(--yellow-500)',
    color:           'var(--foreground)',
    borderRadius:    'var(--radius-md)',
    padding:         '0.65rem 0.875rem',
    fontSize:        'var(--text-body)',
    outline:         'none',
    width:           '100%',
    boxShadow:       'var(--glow-yellow)',
  },

  errorMsg: {
    fontSize:        'var(--text-small)',
    color:           'var(--danger)',
    backgroundColor: 'var(--danger-bg)',
    border:          '1px solid rgba(229,72,77,0.25)',
    borderRadius:    'var(--radius-sm)',
    padding:         '0.5rem 0.75rem',
    margin:          0,
  },

  btn: {
    backgroundColor: 'var(--yellow-500)',
    color:           'var(--background)',
    fontWeight:      'var(--weight-bold)',
    fontSize:        'var(--text-body)',
    padding:         '0.75rem 1.25rem',
    borderRadius:    'var(--radius-md)',
    border:          'none',
    cursor:          'pointer',
    marginTop:       '0.25rem',
    transition:      'background 0.15s, box-shadow 0.15s',
    letterSpacing:   '0.02em',
  },

  btnDisabled: {
    opacity:       0.5,
    cursor:        'not-allowed',
  },

  footer: {
    fontSize:  'var(--text-xs)',
    color:     'var(--text-tertiary)',
    textAlign: 'center',
    margin:    0,
  },
}