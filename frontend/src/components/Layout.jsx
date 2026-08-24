import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// ─── íconos SVG inline ────────────────────────────────────────────────────────
const IconHome      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const IconOrden     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
const IconVer       = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
const IconInventory = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
const IconRepuesto  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
const IconPagos     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
const IconLafise    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
const IconLiquid    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
const IconContab    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
const IconSettings  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
const IconLogout    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IconChevron   = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

// ─── estructura del menú ──────────────────────────────────────────────────────
const MENU = [
  {
    label: 'Dashboard',
    icon: <IconHome />,
    path: '/dashboard',
  },
  {
    label: 'Órdenes',
    icon: <IconOrden />,
    children: [
      { label: 'Nueva orden',   path: '/ordenes/nueva' },
      { label: 'Ver órdenes',   path: '/ordenes' },
    ],
  },
  { label: 'Inventario',    icon: <IconInventory />, path: null, disabled: true },
  { label: 'Repuestos',     icon: <IconRepuesto />,  path: null, disabled: true },
  { label: 'Liquidaciones', icon: <IconLiquid />,    path: null, disabled: true },
  { label: 'Linker LAFISE', icon: <IconLafise />,    path: null, disabled: true },
  { label: 'Contabilidad',  icon: <IconContab />,    path: null, disabled: true },
  { label: 'Ajustes',       icon: <IconSettings />,  path: null, disabled: true },
]

// ─── item de menú ─────────────────────────────────────────────────────────────
function MenuItem({ item, location, navigate, depth = 0 }) {
  const [open, setOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some(c => location.pathname === c.path)
  })

  const isActive = item.path && location.pathname === item.path
  const hasChildren = !!item.children

  function handleClick() {
    if (item.disabled) return
    if (hasChildren) { setOpen(v => !v); return }
    if (item.path) navigate(item.path)
  }

  return (
    <div>
      <div
        onClick={handleClick}
        title={item.disabled ? 'Disponible próximamente' : undefined}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            '0.5rem',
          padding:        `0.35rem ${depth > 0 ? '0.75rem' : '0.75rem'}`,
          paddingLeft:    depth > 0 ? '2.25rem' : '0.75rem',
          borderRadius:   'var(--radius-sm)',
          cursor:         item.disabled ? 'not-allowed' : 'pointer',
          backgroundColor: isActive ? 'rgba(255,195,0,0.1)' : 'transparent',
          color:           isActive ? 'var(--yellow-400)' : item.disabled ? 'var(--neutral-500)' : 'var(--neutral-200)',
          fontWeight:      isActive ? 'var(--weight-semibold)' : 'var(--weight-regular)',
          fontSize:        depth > 0 ? 'var(--text-small)' : 'var(--text-body)',
          transition:      'background-color 0.1s, color 0.1s',
          userSelect:      'none',
        }}
        onMouseEnter={e => { if (!item.disabled && !isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(255,195,0,0.1)' : 'transparent' }}
      >
        <span style={{ opacity: item.disabled ? 0.4 : 1, flexShrink: 0, display: 'flex' }}>{item.icon}</span>
        <span style={{ flex: 1, opacity: item.disabled ? 0.5 : 1 }}>{item.label}</span>
        {hasChildren && <IconChevron open={open} />}
      </div>

      {hasChildren && open && (
        <div>
          {item.children.map(child => (
            <MenuItem key={child.path} item={child} location={location} navigate={navigate} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function Layout({ children }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const usuario = (() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return null
      return JSON.parse(atob(token.split('.')[1]))
    } catch { return null }
  })()

  const W = collapsed ? '56px' : '220px'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width:           W,
        minWidth:        W,
        maxWidth:        W,
        backgroundColor: 'var(--surface)',
        borderRight:     '1px solid var(--border)',
        display:         'flex',
        flexDirection:   'column',
        transition:      'width 0.2s, min-width 0.2s, max-width 0.2s',
        overflow:        'hidden',
        position:        'sticky',
        top:             0,
        height:          '100vh',
      }}>

        {/* cabecera del sidebar */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding:      '1rem 0.75rem 0.75rem',
          borderBottom: '1px solid var(--border)',
          gap:          '0.5rem',
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden' }}>
              <span style={{ fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Taller <span style={{ color: 'var(--yellow-500)' }}>Espinoza</span>
              </span>
              {usuario && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {usuario.nombre}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            style={{
              backgroundColor: 'transparent',
              border:          'none',
              cursor:          'pointer',
              color:           'var(--neutral-400)',
              padding:         '0.25rem',
              borderRadius:    'var(--radius-sm)',
              display:         'flex',
              alignItems:      'center',
              flexShrink:      0,
            }}
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed
                ? <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
                : <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>

        {/* nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          {collapsed
            ? MENU.map((item, i) => (
              <div
                key={i}
                onClick={() => { if (!item.disabled && item.path) navigate(item.path) }}
                title={item.disabled ? 'Disponible próximamente' : item.label}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  padding:         '0.5rem',
                  borderRadius:    'var(--radius-sm)',
                  cursor:          item.disabled ? 'not-allowed' : 'pointer',
                  color:           item.path && location.pathname === item.path ? 'var(--yellow-400)' : item.disabled ? 'var(--neutral-500)' : 'var(--neutral-300)',
                  backgroundColor: item.path && location.pathname === item.path ? 'rgba(255,195,0,0.1)' : 'transparent',
                }}
              >
                <span style={{ opacity: item.disabled ? 0.4 : 1, display: 'flex' }}>{item.icon}</span>
              </div>
            ))
            : MENU.map((item, i) => (
              <MenuItem key={i} item={item} location={location} navigate={navigate} />
            ))
          }
        </nav>

        {/* pie del sidebar */}
        <div style={{ padding: '0.75rem 0.5rem', borderTop: '1px solid var(--border)' }}>
          <div
            onClick={handleLogout}
            style={{
              display:       'flex',
              alignItems:    'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap:           '0.5rem',
              padding:       '0.4rem 0.5rem',
              borderRadius:  'var(--radius-sm)',
              cursor:        'pointer',
              color:         'var(--danger)',
              fontSize:      'var(--text-small)',
              transition:    'background-color 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(229,72,77,0.08)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Cerrar sesión"
          >
            <IconLogout />
            {!collapsed && <span>Cerrar sesión</span>}
          </div>
        </div>

      </aside>

      {/* ── CONTENIDO ────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>

    </div>
  )
}
