import RuleInput from '../components/RuleInput'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { workshopApi as api, currency } from '../lib/workshopApi'
import { ROLE_LABELS, TYPE_LABELS } from '../lib/workers'
import { plain } from '../lib/nicaragua'

const EMPTY = { cedula: '', nombre: '', tipo: 'externo', rol: 'pintor', telefono: '', fijo: false }

function WorkerForm({ initial = EMPTY, busy, onSave, onCancel, submitLabel }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    cedula: initial.cedula || '',
    telefono: initial.telefono || '',
    fijo: !!initial.fijo,
  }))
  const set = (key, value) => setForm(old => ({ ...old, [key]: value }))
  return (
    <form
      className="staff-form"
      onSubmit={e => {
        e.preventDefault()
        onSave(form)
      }}
    >
      <label>
        <span>Nombre completo</span>
        <RuleInput
          rule="name"
          label="Nombre"
          required
          value={form.nombre}
          onChange={e => set('nombre', e.target.value)}
          placeholder="Ej: Carlos Mendoza"
        />
      </label>
      <label>
        <span>Cédula</span>
        <RuleInput
          rule="cedula"
          label="Cédula"
          required
          value={form.cedula}
          onChange={e => set('cedula', e.target.value)}
          placeholder="001-010190-0001A"
        />
      </label>
      <label>
        <span>Teléfono · opcional</span>
        <RuleInput rule="phone" label="Teléfono" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
      </label>
      <label>
        <span>Rol</span>
        <select value={form.rol} onChange={e => set('rol', e.target.value)}>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Tipo</span>
        <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="staff-check">
        <input type="checkbox" checked={form.fijo} onChange={e => set('fijo', e.target.checked)} /> Personal fijo ·
        aparece como opción rápida al asignar trabajos
      </label>
      <div className="staff-form-actions">
        <button type="submit" className="btn-cyber-orange" disabled={busy}>
          {busy ? 'Guardando…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

export default function Personal() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [query, setQuery] = useState(''),
    [view, setView] = useState('activos')
  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false)
  let admin = false
  try {
    admin = JSON.parse(atob(localStorage.getItem('token').split('.')[1])).rol === 'administrador'
  } catch {
    /* the API enforces permissions */
  }

  const load = useCallback(async () => {
    try {
      setRows(await api('/api/operaciones/personal/lista?todos=1'))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [])
  useDeferredLoad(load)

  async function run(action, done) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      await load()
      setMessage(done)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const create = form =>
    run(async () => {
      await api('/api/operaciones/personal', 'POST', form)
      setAdding(false)
    }, `${form.nombre.trim()} quedó registrado.`)
  const save = (id, form) =>
    run(async () => {
      await api(`/api/operaciones/personal/${id}`, 'PUT', form)
      setEditing(null)
    }, 'Cambios guardados.')
  const toggle = worker => {
    if (
      worker.activo &&
      !window.confirm(
        `¿Dar de baja a ${worker.nombre}? Ya no aparecerá al asignar trabajos. Su historial y liquidaciones se conservan.`
      )
    )
      return
    run(
      () => api(`/api/operaciones/personal/${worker.id}/activo`, 'PATCH', { activo: !worker.activo }),
      worker.activo ? `${worker.nombre} quedó de baja.` : `${worker.nombre} está activo otra vez.`
    )
  }

  const active = rows?.filter(r => r.activo) ?? []
  const inactive = rows?.filter(r => !r.activo) ?? []
  const list = (view === 'activos' ? active : inactive).filter(r =>
    plain(`${r.nombre} ${r.cedula || ''} ${ROLE_LABELS[r.rol]} ${r.telefono || ''}`).includes(plain(query))
  )
  const pending = active.reduce((sum, r) => sum + Number(r.pendiente || 0), 0)

  return (
    <div className="work-page staff-page">
      <header className="section-heading">
        <div>
          <span className="section-kicker">RECURSOS / EQUIPO</span>
          <h1>Personal del taller</h1>
          <p className="work-muted">
            Trabajadores que puedes asignar a las órdenes, con su cédula, trabajos y montos acordados.
          </p>
        </div>
        <button
          className="btn-cyber-orange"
          onClick={() => {
            setAdding(v => !v)
            setEditing(null)
          }}
          aria-expanded={adding}
        >
          {adding ? 'Cerrar formulario' : '+ Registrar trabajador'}
        </button>
      </header>
      {(error || message) && (
        <p role={error ? 'alert' : 'status'} className={error ? 'staff-error' : 'staff-ok'}>
          {error || message}
        </p>
      )}
      {adding && (
        <section className="work-panel">
          <h2>Nuevo trabajador</h2>
          <WorkerForm
            busy={busy}
            onSave={create}
            onCancel={() => setAdding(false)}
            submitLabel="Registrar trabajador"
          />
        </section>
      )}

      <div className="staff-summary">
        <div>
          <span>Trabajadores activos</span>
          <strong>{rows ? active.length : '…'}</strong>
          <small>{rows ? `${active.filter(r => r.fijo).length} fijos` : ''}</small>
        </div>
        <div>
          <span>Trabajos asignados</span>
          <strong>{rows ? active.reduce((sum, r) => sum + Number(r.trabajos || 0), 0) : '…'}</strong>
          <small>Personal activo</small>
        </div>
        <div>
          <span>Pendiente por liquidar</span>
          <strong>{rows ? currency(pending) : '…'}</strong>
          <small>
            {admin ? <Link to="/liquidaciones">Ir a liquidaciones ↗</Link> : 'Montos acordados sin pagar'}
          </small>
        </div>
      </div>

      <section className="work-panel">
        <div className="staff-toolbar">
          <div className="staff-tabs" role="group" aria-label="Estado">
            {[
              ['activos', `Activos · ${active.length}`],
              ['baja', `De baja · ${inactive.length}`],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={view === key}
                className={view === key ? 'is-on' : ''}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            aria-label="Buscar trabajador"
            placeholder="Buscar por nombre, cédula, rol o teléfono…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        {!rows ? (
          <p role="status">{error ? 'No se pudo cargar el personal.' : 'Cargando personal…'}</p>
        ) : !list.length ? (
          <p className="work-muted">
            {view === 'activos' ? 'No hay trabajadores activos que coincidan.' : 'No hay trabajadores dados de baja.'}
          </p>
        ) : (
          <ul className="staff-list">
            {list.map(w => (
              <li key={w.id} className={w.activo ? '' : 'is-inactive'}>
                {editing === w.id ? (
                  <WorkerForm
                    initial={w}
                    busy={busy}
                    onSave={form => save(w.id, form)}
                    onCancel={() => setEditing(null)}
                    submitLabel="Guardar cambios"
                  />
                ) : (
                  <>
                    <div className="staff-avatar" aria-hidden="true">
                      {w.nombre.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="staff-main">
                      <strong>
                        {w.nombre}
                        {w.fijo ? <em>Fijo</em> : null}
                      </strong>
                      <span>
                        {w.cedula ? `${w.cedula} · ` : ''}
                        {ROLE_LABELS[w.rol] || w.rol} · {TYPE_LABELS[w.tipo] || w.tipo}
                        {w.telefono ? ` · ${w.telefono}` : ''}
                      </span>
                    </div>
                    <div className="staff-stats">
                      <span>
                        <b>{w.trabajos}</b> {Number(w.trabajos) === 1 ? 'trabajo' : 'trabajos'}
                      </span>
                      <span>Acordado {currency(w.total_acordado)}</span>
                      {Number(w.pendiente) > 0 && (
                        <span className="staff-pending">Por liquidar {currency(w.pendiente)}</span>
                      )}
                    </div>
                    {admin && (
                      <div className="staff-actions">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditing(w.id)
                            setAdding(false)
                          }}
                        >
                          Editar
                        </button>
                        <button type="button" disabled={busy} onClick={() => toggle(w)}>
                          {w.activo ? 'Dar de baja' : 'Reactivar'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {!admin && rows && (
          <p className="work-muted">Solo administración puede editar o dar de baja a un trabajador.</p>
        )}
      </section>
    </div>
  )
}