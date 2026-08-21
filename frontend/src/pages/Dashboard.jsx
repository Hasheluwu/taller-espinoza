import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [usuario, setUsuario] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    // Decodificar el payload del JWT sin librería (solo lectura, no verificación)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUsuario(payload)
    } catch {
      // Token malformado — limpiar y redirigir
      localStorage.removeItem('token')
      navigate('/login')
    }
  }, [navigate])

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  if (!usuario) return null

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.statusDot} />

        <div style={styles.info}>
          <span style={styles.label}>Sesión activa</span>
          <p style={styles.nombre}>
            <span style={styles.accent}>{usuario.nombre}</span>
          </p>
          <p style={styles.meta}>{usuario.email}</p>
          <p style={styles.rol}>
            Rol: <strong style={styles.accent}>{usuario.rol}</strong>
          </p>
        </div>

        <p style={styles.placeholder}>
          El sistema está en construcción.{' '}
          <span style={styles.accentSubtle}>Pronto verás el dashboard aquí.</span>
        </p>

        <button onClick={handleLogout} style={styles.btnLogout}>
          Cerrar sesión
        </button>

      </div>
    </div>
  )
}

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
    maxWidth:        '400px',
    backgroundColor: 'var(--surface)',
    border:          '1px solid var(--border)',
    borderRadius:    'var(--radius-xl)',
    padding:         '2.5rem 2rem',
    display:         'flex',
    flexDirection:   'column',
    gap:             '1.5rem',
    boxShadow:       'var(--shadow-lg)',
    alignItems:      'flex-start',
  },

  statusDot: {
    width:           '10px',
    height:          '10px',
    borderRadius:    '50%',
    backgroundColor: 'var(--success)',
    boxShadow:       '0 0 8px rgba(34,197,94,0.5)',
  },

  info: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.25rem',
    width:         '100%',
  },

  label: {
    fontSize:      'var(--text-xs)',
    color:         'var(--neutral-300)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight:    'var(--weight-medium)',
  },

  nombre: {
    fontSize:   'var(--text-subtitle)',
    fontWeight: 'var(--weight-bold)',
    color:      'var(--foreground)',
    margin:     '0.15rem 0 0',
  },

  meta: {
    fontSize: 'var(--text-small)',
    color:    'var(--text-tertiary)',
    margin:   0,
  },

  rol: {
    fontSize:  'var(--text-small)',
    color:     'var(--neutral-200)',
    marginTop: '0.35rem',
  },

  accent: {
    color: 'var(--yellow-500)',
  },

  accentSubtle: {
    color: 'var(--yellow-300)',
  },

  placeholder: {
    fontSize:        'var(--text-small)',
    color:           'var(--text-tertiary)',
    backgroundColor: 'var(--surface-raised)',
    border:          '1px solid var(--border)',
    borderRadius:    'var(--radius-md)',
    padding:         '0.75rem 1rem',
    width:           '100%',
    margin:          0,
    lineHeight:      1.6,
  },

  btnLogout: {
    backgroundColor: 'transparent',
    color:           'var(--danger)',
    border:          '1px solid rgba(229,72,77,0.35)',
    borderRadius:    'var(--radius-md)',
    padding:         '0.625rem 1.25rem',
    fontSize:        'var(--text-body)',
    fontWeight:      'var(--weight-semibold)',
    cursor:          'pointer',
    width:           '100%',
    transition:      'background 0.15s, border-color 0.15s',
  },
}