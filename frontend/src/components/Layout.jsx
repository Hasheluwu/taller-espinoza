import GlobalSearch from './GlobalSearch'
import '../workspace.css'
import '../features.css'
import { apiFetch } from '../lib/api'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

const links = [
  { path: '/facturas', label: 'Facturas del seguro', icon: 'order' },
  { path: '/particulares', label: 'Trabajos particulares', icon: 'tool' },
  { path: '/dashboard', label: 'Resumen general', icon: 'grid' },
  { path: '/cotizaciones', label: 'Presupuestos para cotización', icon: 'order' },
  { path: '/proformas', label: 'Presupuestos con orden', icon: 'order' },
  { path: '/ordenes', label: 'Órdenes de trabajo', icon: 'order' },
  { path: '/inventario', label: 'Inventario', icon: 'box' },
  { path: '/repuestos', label: 'Repuestos', icon: 'tool' },
  { path: '/personal', label: 'Personal del taller', icon: 'people' },
  { path: '/historial', label: 'Historial de vehículos', icon: 'history' },
  { path: '/agenda', label: 'Agenda y entregas', icon: 'calendar' },
  { path: '/liquidaciones', label: 'Liquidaciones', icon: 'people' },
]
function Icon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    order: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/></>,
    box: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z M3 8l9 5 9-5M12 13v9M7 6l9 5"/></>,
    tool: <><path d="M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3"/></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    exit: <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/></>,
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  async function logout() {
    try {
      const res = await apiFetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
      if (!res.ok && res.status !== 401) throw new Error('No se pudo cerrar la sesión. Intenta nuevamente.')
      localStorage.removeItem('token'); navigate('/login')
    } catch (err) { setLogoutError(err.message) }
  }
  const location = useLocation()
  const navigate = useNavigate()
  let usuario = null
  try { usuario = JSON.parse(atob(localStorage.getItem('token').split('.')[1])) } catch { /* Token validation belongs to the API. */ }
  const title = location.pathname.includes('/ordenes/nueva') ? 'Nueva orden' : links.find(link => location.pathname.startsWith(link.path))?.label || 'Detalle de orden'
  return (
    <div className="app-shell">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      {mobileOpen && <button className="nav-backdrop" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} id="navegacion">
        <NavLink to="/dashboard" className="brand" onClick={() => setMobileOpen(false)}>
          <img className="brand-logo" src="/images/logo-taller-espinoza.png" alt="Logo Taller Espinoza" width="52" height="55"/>
          <span><strong>ESPINOZA</strong><small>TALLER AUTOMOTRIZ</small></span>
        </NavLink>
        <div className="sidebar-body">
          <NavLink to="/ordenes/nueva" className="btn-cyber-orange new-order" onClick={() => setMobileOpen(false)}><span aria-hidden="true">＋</span> Nueva orden</NavLink>
          <nav aria-label="Navegación principal">
            {[
              { title: 'OPERACIÓN DEL TALLER', paths: ['/dashboard', '/ordenes', '/particulares', '/agenda', '/proformas', '/cotizaciones'] },
              { title: 'RECURSOS', paths: ['/inventario', '/repuestos', '/personal'] },
              { title: 'CONTROL Y SEGUIMIENTO', paths: ['/historial', '/liquidaciones', '/facturas'] },
            ].map(group => <div className="nav-group" key={group.title}>
              <p className="nav-label">{group.title}</p>
              {group.paths.map(path => {
                const link = links.find(item => item.path === path)
                return <NavLink key={path} to={path} end={path === '/dashboard'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon name={link.icon}/>{link.label}<span className="nav-indicator"/></NavLink>
              })}
            </div>)}
          </nav>
          <div className="sidebar-signature"><span>PE /</span> Enderezado · Pintura · Mecánica</div>
        </div>
        {logoutError && <p role="alert" className="login-error">{logoutError}</p>}<div className="sidebar-footer"><div className="user-avatar">{usuario?.nombre?.charAt(0).toUpperCase() || 'E'}</div><div className="user-info"><strong>{usuario?.nombre || 'Mi cuenta'}</strong><small>{usuario?.rol || 'Personal del taller'}</small></div><button className="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={logout}><Icon name="exit"/></button></div>
      </aside>
      <div className="app-workspace">
        <header className="topbar"><div className="topbar-location"><button className="icon-button mobile-toggle" aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileOpen} aria-controls="navegacion" onClick={() => setMobileOpen(!mobileOpen)}><Icon name="menu"/></button><span className="breadcrumb-brand">Mi taller <span>/</span></span><strong>{title}</strong></div><GlobalSearch/><time dateTime={new Date().toLocaleDateString('en-CA')}>{new Date().toLocaleDateString('es-NI', { day: 'numeric', month: 'long', year: 'numeric' })}</time></header>
        <main id="contenido" className="page-content" key={location.pathname}>{children}</main>
        <footer className="workspace-footer"><span>Taller Pedro Espinoza</span><span>Gestión automotriz</span></footer>
      </div>
    </div>
  )
}


