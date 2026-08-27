// frontend/src/pages/Operaciones.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = 'http://localhost:3001'
const fmt = n => Number(n).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── encabezado de la orden ───────────────────────────────────────────────────
function EncabezadoOrden({ orden }) {
  if (!orden) return null
  const st = {
    recibido: '#6b8aaa', en_proceso: '#FFC300',
    listo: '#22c55e', entregado: '#3385d6', cancelado: '#e5484d',
  }
  return (
    <div style={s.encabezado}>
      <div style={s.encIzq}>
        <span style={s.matricula}>{orden.matricula}</span>
        <span style={s.encSub}>{orden.marca} {orden.modelo} {orden.anio_fabricacion}</span>
        <span style={s.encSub}>{orden.nombre_cliente} — {orden.cedula}</span>
      </div>
      <div style={s.encDer}>
        <span style={{ ...s.estadoBadge, color: st[orden.estado] || '#6b8aaa', borderColor: st[orden.estado] || '#6b8aaa' }}>
          {orden.estado.replace('_', ' ')}
        </span>
        <span style={s.tipoBadge}>{orden.tipo}</span>
        <span style={s.tipoBadge}>{orden.tipo_pago}</span>
      </div>
    </div>
  )
}

// ─── sección colapsable ───────────────────────────────────────────────────────
function Seccion({ titulo, abierta, onToggle, children }) {
  return (
    <div style={abierta ? s.seccionAbierta : s.seccion}>
      <button onClick={onToggle} style={s.seccionBtn}>
        <span style={s.seccionTitulo}>{titulo}</span>
        <span style={s.seccionChevron}>{abierta ? '▲' : '▼'}</span>
      </button>
      {abierta && <div style={s.seccionBody}>{children}</div>}
    </div>
  )
}

// ─── campo helper ─────────────────────────────────────────────────────────────
function Campo({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-200)', fontWeight: 'var(--weight-medium)' }}>
        <span style={{ color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' }}>{label}</span>
        {!required && <span style={{ color: 'var(--neutral-400)', fontSize: 'var(--text-xs)' }}> — opcional</span>}
      </label>
      {children}
    </div>
  )
}

// ─── sección servicios ────────────────────────────────────────────────────────
function SeccionServicios({ idOrden, onOperacionHecha }) {
  const [servicios, setServicios] = useState([])
  const [form, setForm]           = useState({ descripcion: '', precio: '', aplica_iva: true })
  const [creando, setCreando]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const res  = await fetch(`${API}/api/operaciones/${idOrden}/servicios`, { headers: { Authorization: `Bearer ${getToken()}` } })
    const data = await res.json()
    if (res.ok) setServicios(data)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setCreando(true)
    try {
      const res  = await fetch(`${API}/api/operaciones/${idOrden}/servicios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      setServicios(prev => [...prev, data])
      setForm({ descripcion: '', precio: '', aplica_iva: true })
      onOperacionHecha()
    } catch { setError('Error de conexión.') }
    finally { setCreando(false) }
  }

  async function handleEliminar(id) {
    await fetch(`${API}/api/operaciones/servicios/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
    setServicios(prev => prev.filter(sv => sv.id !== id))
  }

  return (
    <div style={s.seccionInterna}>
      <div style={s.dosColumnas}>
        <div>
          <form onSubmit={handleSubmit} style={s.form}>
            <Campo label="Descripción" required>
              <input type="text" value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Pintura de capó" style={s.input} required
                onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                onBlur={e  => Object.assign(e.target.style, s.input)} />
            </Campo>
            <Campo label="Precio (C$)" required>
              <input type="number" min="0" step="0.01" value={form.precio}
                onChange={e => setForm(p => ({ ...p, precio: e.target.value }))}
                placeholder="Ej: 1500.00" style={s.input} required
                onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                onBlur={e  => Object.assign(e.target.style, s.input)} />
            </Campo>
            <label style={s.checkRow}>
              <input type="checkbox" checked={form.aplica_iva}
                onChange={e => setForm(p => ({ ...p, aplica_iva: e.target.checked }))} style={s.chk} />
              <span style={s.label}>Aplica <span style={s.accent}>IVA</span></span>
            </label>
            {error && <p style={s.err}>{error}</p>}
            <button type="submit" disabled={creando} style={creando ? s.btnDisabled : s.btnPrimary}>
              {creando ? 'Guardando...' : 'Agregar servicio'}
            </button>
          </form>
        </div>
        <div>
          {servicios.length === 0
            ? <p style={s.vacio}>Sin líneas registradas.</p>
            : servicios.map(sv => (
              <div key={sv.id} style={s.filaItem}>
                <div style={s.filaItemMain}>
                  <span style={s.itemDesc}>{sv.descripcion}</span>
                  <span style={s.itemVal}>C$ {fmt(sv.precio)}</span>
                  <span style={sv.aplica_iva ? s.ivaOn : s.ivaOff}>{sv.aplica_iva ? 'IVA' : '—'}</span>
                </div>
                <button onClick={() => handleEliminar(sv.id)} style={s.btnX}>✕</button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── sección materiales + personal ───────────────────────────────────────────
function SeccionMateriales({ idOrden, onOperacionHecha }) {
  const [materiales, setMateriales]       = useState([])
  const [personal, setPersonal]           = useState([])
  const [inventario, setInventario]       = useState([])
  const [personalLista, setPersonalLista] = useState([])
  const [formMat, setFormMat]             = useState({ id_material: '', cantidad_usada: '' })
  const [formPers, setFormPers]           = useState({ id_personal: '', monto_acordado: '' })
  const [formNuevoPers, setFormNuevoPers] = useState({ nombre: '', tipo: 'externo', rol: 'pintor', telefono: '', fijo: false })
  const [mostrarNuevoPers, setMostrarNuevoPers] = useState(false)
  const [error, setError]                 = useState('')
  const [creando, setCreando]             = useState(false)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    const headers = { Authorization: `Bearer ${getToken()}` }
    const [rMat, rPers, rInv, rPersL] = await Promise.all([
      fetch(`${API}/api/operaciones/${idOrden}/materiales`, { headers }),
      fetch(`${API}/api/operaciones/${idOrden}/personal`, { headers }),
      fetch(`${API}/api/operaciones/inventario/lista`, { headers }),
      fetch(`${API}/api/operaciones/personal/lista`, { headers }),
    ])
    if (rMat.ok)   setMateriales(await rMat.json())
    if (rPers.ok)  setPersonal(await rPers.json())
    if (rInv.ok)   setInventario(await rInv.json())
    if (rPersL.ok) setPersonalLista(await rPersL.json())
  }

  async function handleSubmitMat(e) {
    e.preventDefault(); setError(''); setCreando(true)
    try {
      if (!formPers.id_personal || !formPers.monto_acordado)
        throw new Error('Debés asignar personal antes de registrar el material.')

      const res = await fetch(`${API}/api/operaciones/${idOrden}/materiales`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(formMat),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      const resPers = await fetch(`${API}/api/operaciones/${idOrden}/personal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(formPers),
      })
      const dataPers = await resPers.json()
      if (!resPers.ok) throw new Error(dataPers.message)

      setMateriales(prev => [...prev, data])
      setPersonal(prev => [...prev, dataPers])
      setFormMat({ id_material: '', cantidad_usada: '' })
      setFormPers({ id_personal: '', monto_acordado: '' })
      onOperacionHecha()
    } catch (err) { setError(err.message) }
    finally { setCreando(false) }
  }

  async function handleCrearPersonal(e) {
    e.preventDefault()
    const res  = await fetch(`${API}/api/operaciones/personal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(formNuevoPers),
    })
    const data = await res.json()
    if (res.ok) {
      setPersonalLista(prev => [data, ...prev])
      setFormPers(p => ({ ...p, id_personal: data.id }))
      setMostrarNuevoPers(false)
      setFormNuevoPers({ nombre: '', tipo: 'externo', rol: 'pintor', telefono: '', fijo: false })
    }
  }

  async function handleEliminarMat(id) {
    await fetch(`${API}/api/operaciones/materiales/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
    setMateriales(prev => prev.filter(m => m.id !== id))
  }

  async function handleEliminarPers(id) {
    await fetch(`${API}/api/operaciones/personal-asignado/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
    setPersonal(prev => prev.filter(p => p.id !== id))
  }

  const fijos = personalLista.filter(p => p.fijo)
  const otros  = personalLista.filter(p => !p.fijo)

  return (
    <div style={s.seccionInterna}>
      <div style={s.dosColumnas}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={s.seccionSubtitulo}>Material</p>
          <Campo label="Material" required>
            <select value={formMat.id_material}
              onChange={e => setFormMat(p => ({ ...p, id_material: e.target.value }))} style={s.input} required>
              <option value="">Seleccioná un material...</option>
              {inventario.map(i => (
                <option key={i.id} value={i.id}>{i.nombre} — {i.cantidad} {i.unidad_medida} disp.</option>
              ))}
            </select>
          </Campo>
          <Campo label="Cantidad usada" required>
            <input type="number" min="0.01" step="0.01" value={formMat.cantidad_usada}
              onChange={e => setFormMat(p => ({ ...p, cantidad_usada: e.target.value }))}
              placeholder="Ej: 2.5" style={s.input} required
              onFocus={e => Object.assign(e.target.style, s.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, s.input)} />
          </Campo>

          <p style={s.seccionSubtitulo}>Personal</p>
          {fijos.length > 0 && (
            <div style={s.fijosRow}>
              {fijos.map(p => (
                <button key={p.id} type="button"
                  onClick={() => setFormPers(prev => ({ ...prev, id_personal: p.id }))}
                  style={formPers.id_personal == p.id ? s.fijoActivo : s.fijoBtn}>
                  {p.nombre}
                </button>
              ))}
            </div>
          )}
          <Campo label="Personal">
            <select value={formPers.id_personal}
              onChange={e => setFormPers(p => ({ ...p, id_personal: e.target.value }))} style={s.input}>
              <option value="">Seleccioná personal...</option>
              {fijos.length > 0 && <optgroup label="— Fijos —">{fijos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.rol})</option>)}</optgroup>}
              {otros.length > 0  && <optgroup label="— Otros —">{otros.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.rol})</option>)}</optgroup>}
            </select>
          </Campo>
          <Campo label="Monto acordado (C$)" required>
            <input type="number" min="0" step="0.01" value={formPers.monto_acordado}
              onChange={e => setFormPers(p => ({ ...p, monto_acordado: e.target.value }))}
              placeholder="Ej: 800.00" style={s.input}
              onFocus={e => Object.assign(e.target.style, s.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, s.input)} />
          </Campo>

          <button type="button" onClick={() => setMostrarNuevoPers(v => !v)} style={s.btnGhost}>
            {mostrarNuevoPers ? '— Cancelar nuevo personal' : '+ Agregar nuevo personal'}
          </button>

          {mostrarNuevoPers && (
            <form onSubmit={handleCrearPersonal} style={{ ...s.form, backgroundColor: 'var(--surface-raised)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <Campo label="Nombre" required>
                <input type="text" value={formNuevoPers.nombre}
                  onChange={e => setFormNuevoPers(p => ({ ...p, nombre: e.target.value }))}
                  style={s.input} required
                  onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                  onBlur={e  => Object.assign(e.target.style, s.input)} />
              </Campo>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Campo label="Tipo">
                  <select value={formNuevoPers.tipo}
                    onChange={e => setFormNuevoPers(p => ({ ...p, tipo: e.target.value }))} style={s.input}>
                    <option value="externo">Externo</option>
                    <option value="interno">Interno</option>
                  </select>
                </Campo>
                <Campo label="Rol">
                  <select value={formNuevoPers.rol}
                    onChange={e => setFormNuevoPers(p => ({ ...p, rol: e.target.value }))} style={s.input}>
                    <option value="pintor">Pintor</option>
                    <option value="enderezador">Enderezador</option>
                    <option value="mecanico">Mecánico</option>
                    <option value="otro">Otro</option>
                  </select>
                </Campo>
              </div>
              <Campo label="Teléfono (opcional)">
                <input type="text" value={formNuevoPers.telefono}
                  onChange={e => setFormNuevoPers(p => ({ ...p, telefono: e.target.value }))}
                  style={s.input}
                  onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                  onBlur={e  => Object.assign(e.target.style, s.input)} />
              </Campo>
              <label style={s.checkRow}>
                <input type="checkbox" checked={formNuevoPers.fijo}
                  onChange={e => setFormNuevoPers(p => ({ ...p, fijo: e.target.checked }))} style={s.chk} />
                <span style={s.label}>Personal fijo (aparece siempre como opción rápida)</span>
              </label>
              <button type="submit" style={s.btnSecondary}>Crear personal</button>
            </form>
          )}

          {error && <p style={s.err}>{error}</p>}
          <button onClick={handleSubmitMat} disabled={creando} style={creando ? s.btnDisabled : s.btnPrimary}>
            {creando ? 'Registrando...' : 'Registrar material + personal'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <p style={s.seccionSubtitulo}>Materiales registrados</p>
            {materiales.length === 0
              ? <p style={s.vacio}>Sin materiales.</p>
              : materiales.map(m => (
                <div key={m.id} style={s.filaItem}>
                  <div style={s.filaItemMain}>
                    <span style={s.itemDesc}>{m.nombre_material}</span>
                    <span style={s.itemVal}>×{m.cantidad_usada} {m.unidad_medida}</span>
                    <span style={s.itemVal}>C$ {fmt(m.precio_unitario)}</span>
                  </div>
                  <button onClick={() => handleEliminarMat(m.id)} style={s.btnX}>✕</button>
                </div>
              ))
            }
          </div>
          <div>
            <p style={s.seccionSubtitulo}>Personal asignado</p>
            {personal.length === 0
              ? <p style={s.vacio}>Sin personal asignado.</p>
              : personal.map(p => (
                <div key={p.id} style={s.filaItem}>
                  <div style={s.filaItemMain}>
                    <span style={s.itemDesc}>{p.nombre_personal}</span>
                    <span style={s.itemMeta}>{p.rol}</span>
                    <span style={s.itemVal}>C$ {fmt(p.monto_acordado)}</span>
                  </div>
                  <button onClick={() => handleEliminarPers(p.id)} style={s.btnX}>✕</button>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── sección repuestos + personal ─────────────────────────────────────────────
function SeccionRepuestos({ idOrden, onOperacionHecha }) {
  const [repuestos, setRepuestos]         = useState([])
  const [personal, setPersonal]           = useState([])
  const [lista, setLista]                 = useState([])
  const [personalLista, setPersonalLista] = useState([])
  const [formRep, setFormRep]             = useState({ id_repuesto: '', cantidad_usada: '' })
  const [formPers, setFormPers]           = useState({ id_personal: '', monto_acordado: '' })
  const [formNuevoPers, setFormNuevoPers] = useState({ nombre: '', tipo: 'externo', rol: 'pintor', telefono: '', fijo: false })
  const [mostrarNuevoPers, setMostrarNuevoPers] = useState(false)
  const [error, setError]                 = useState('')
  const [creando, setCreando]             = useState(false)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    const headers = { Authorization: `Bearer ${getToken()}` }
    const [rRep, rPers, rLista, rPersL] = await Promise.all([
      fetch(`${API}/api/operaciones/${idOrden}/repuestos`, { headers }),
      fetch(`${API}/api/operaciones/${idOrden}/personal`, { headers }),
      fetch(`${API}/api/operaciones/repuestos/lista`, { headers }),
      fetch(`${API}/api/operaciones/personal/lista`, { headers }),
    ])
    if (rRep.ok)   setRepuestos(await rRep.json())
    if (rPers.ok)  setPersonal(await rPers.json())
    if (rLista.ok) setLista(await rLista.json())
    if (rPersL.ok) setPersonalLista(await rPersL.json())
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setCreando(true)
    try {
      if (!formPers.id_personal || !formPers.monto_acordado)
        throw new Error('Debés asignar personal.')
      const res = await fetch(`${API}/api/operaciones/${idOrden}/repuestos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(formRep),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      const resPers = await fetch(`${API}/api/operaciones/${idOrden}/personal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(formPers),
      })
      const dataPers = await resPers.json()
      if (!resPers.ok) throw new Error(dataPers.message)
      setRepuestos(prev => [...prev, data])
      setPersonal(prev => [...prev, dataPers])
      setFormRep({ id_repuesto: '', cantidad_usada: '' })
      setFormPers({ id_personal: '', monto_acordado: '' })
      onOperacionHecha()
    } catch (err) { setError(err.message) }
    finally { setCreando(false) }
  }

  async function handleCrearPersonal(e) {
    e.preventDefault()
    const res  = await fetch(`${API}/api/operaciones/personal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(formNuevoPers),
    })
    const data = await res.json()
    if (res.ok) {
      setPersonalLista(prev => [data, ...prev])
      setFormPers(p => ({ ...p, id_personal: data.id }))
      setMostrarNuevoPers(false)
    }
  }

  const fijos = personalLista.filter(p => p.fijo)
  const otros  = personalLista.filter(p => !p.fijo)

  return (
    <div style={s.seccionInterna}>
      <div style={s.dosColumnas}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={s.seccionSubtitulo}>Repuesto</p>
          <Campo label="Repuesto" required>
            <select value={formRep.id_repuesto}
              onChange={e => setFormRep(p => ({ ...p, id_repuesto: e.target.value }))} style={s.input} required>
              <option value="">Seleccioná un repuesto...</option>
              {lista.map(r => (
                <option key={r.id} value={r.id}>{r.nombre} — {r.marca} {r.modelo} ({r.cantidad} disp.)</option>
              ))}
            </select>
          </Campo>
          <Campo label="Cantidad usada" required>
            <input type="number" min="1" step="1" value={formRep.cantidad_usada}
              onChange={e => setFormRep(p => ({ ...p, cantidad_usada: e.target.value }))}
              placeholder="Ej: 1" style={s.input} required
              onFocus={e => Object.assign(e.target.style, s.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, s.input)} />
          </Campo>

          <p style={s.seccionSubtitulo}>Personal</p>
          {fijos.length > 0 && (
            <div style={s.fijosRow}>
              {fijos.map(p => (
                <button key={p.id} type="button"
                  onClick={() => setFormPers(prev => ({ ...prev, id_personal: p.id }))}
                  style={formPers.id_personal == p.id ? s.fijoActivo : s.fijoBtn}>
                  {p.nombre}
                </button>
              ))}
            </div>
          )}
          <Campo label="Personal">
            <select value={formPers.id_personal}
              onChange={e => setFormPers(p => ({ ...p, id_personal: e.target.value }))} style={s.input}>
              <option value="">Seleccioná personal...</option>
              {fijos.length > 0 && <optgroup label="— Fijos —">{fijos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.rol})</option>)}</optgroup>}
              {otros.length > 0  && <optgroup label="— Otros —">{otros.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.rol})</option>)}</optgroup>}
            </select>
          </Campo>
          <Campo label="Monto acordado (C$)" required>
            <input type="number" min="0" step="0.01" value={formPers.monto_acordado}
              onChange={e => setFormPers(p => ({ ...p, monto_acordado: e.target.value }))}
              placeholder="Ej: 500.00" style={s.input}
              onFocus={e => Object.assign(e.target.style, s.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, s.input)} />
          </Campo>

          <button type="button" onClick={() => setMostrarNuevoPers(v => !v)} style={s.btnGhost}>
            {mostrarNuevoPers ? '— Cancelar nuevo personal' : '+ Agregar nuevo personal'}
          </button>

          {mostrarNuevoPers && (
            <form onSubmit={handleCrearPersonal} style={{ ...s.form, backgroundColor: 'var(--surface-raised)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <Campo label="Nombre" required>
                <input type="text" value={formNuevoPers.nombre}
                  onChange={e => setFormNuevoPers(p => ({ ...p, nombre: e.target.value }))}
                  style={s.input} required
                  onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                  onBlur={e  => Object.assign(e.target.style, s.input)} />
              </Campo>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Campo label="Tipo">
                  <select value={formNuevoPers.tipo}
                    onChange={e => setFormNuevoPers(p => ({ ...p, tipo: e.target.value }))} style={s.input}>
                    <option value="externo">Externo</option>
                    <option value="interno">Interno</option>
                  </select>
                </Campo>
                <Campo label="Rol">
                  <select value={formNuevoPers.rol}
                    onChange={e => setFormNuevoPers(p => ({ ...p, rol: e.target.value }))} style={s.input}>
                    <option value="pintor">Pintor</option>
                    <option value="enderezador">Enderezador</option>
                    <option value="mecanico">Mecánico</option>
                    <option value="otro">Otro</option>
                  </select>
                </Campo>
              </div>
              <button type="submit" style={s.btnSecondary}>Crear personal</button>
            </form>
          )}

          {error && <p style={s.err}>{error}</p>}
          <button onClick={handleSubmit} disabled={creando} style={creando ? s.btnDisabled : s.btnPrimary}>
            {creando ? 'Registrando...' : 'Registrar repuesto + personal'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <p style={s.seccionSubtitulo}>Repuestos registrados</p>
            {repuestos.length === 0
              ? <p style={s.vacio}>Sin repuestos.</p>
              : repuestos.map(r => (
                <div key={r.id} style={s.filaItem}>
                  <div style={s.filaItemMain}>
                    <span style={s.itemDesc}>{r.nombre_repuesto}</span>
                    <span style={s.itemMeta}>{r.marca} {r.modelo}</span>
                    <span style={s.itemVal}>×{r.cantidad_usada}</span>
                    <span style={s.itemVal}>C$ {fmt(r.precio_unitario)}</span>
                  </div>
                </div>
              ))
            }
          </div>
          <div>
            <p style={s.seccionSubtitulo}>Personal asignado</p>
            {personal.length === 0
              ? <p style={s.vacio}>Sin personal.</p>
              : personal.map(p => (
                <div key={p.id} style={s.filaItem}>
                  <div style={s.filaItemMain}>
                    <span style={s.itemDesc}>{p.nombre_personal}</span>
                    <span style={s.itemMeta}>{p.rol}</span>
                    <span style={s.itemVal}>C$ {fmt(p.monto_acordado)}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── sección daños ocultos ────────────────────────────────────────────────────
function SeccionDanos({ idOrden, tipoPago, onOperacionHecha, navigate }) {
  const [danos, setDanos]     = useState([])
  const [form, setForm]       = useState({
    descripcion: '', costo_adicional: '', aplica_seguro: false,
    monto_cubierto_seguro: '', monto_extra_cliente: '',
  })
  const [creando, setCreando] = useState(false)
  const [error, setError]     = useState('')
  const esSeguro = tipoPago === 'lafise' || tipoPago === 'iniser'

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const res = await fetch(`${API}/api/operaciones/${idOrden}/danos`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (res.ok) setDanos(await res.json())
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setCreando(true)
    try {
      const res  = await fetch(`${API}/api/operaciones/${idOrden}/danos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      setDanos(prev => [...prev, data])
      setForm({ descripcion: '', costo_adicional: '', aplica_seguro: false, monto_cubierto_seguro: '', monto_extra_cliente: '' })
      onOperacionHecha()
    } catch { setError('Error de conexión.') }
    finally { setCreando(false) }
  }

  const [navegando, setNavegando] = useState(false)
  const [errorNav, setErrorNav]   = useState('')

  async function irAOrdenDerivada() {
    setNavegando(true)
    setErrorNav('')
    try {
      const res = await fetch(`${API}/api/ordenes/${idOrden}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('No se pudo cargar la orden.')
      const orden = await res.json()

      const cliente  = { id: orden.id_cliente,  nombre: orden.nombre_cliente, cedula: orden.cedula, telefono: orden.telefono }
      const vehiculo = { id: orden.id_vehiculo, matricula: orden.matricula, marca: orden.marca, modelo: orden.modelo, anio_fabricacion: orden.anio_fabricacion, aseguradora: orden.aseguradora_vehiculo ?? 'ninguna', color: orden.color }

      navigate('/ordenes/nueva/orden', {
        state: {
          cliente,
          vehiculo,
          presupuesto: null,
          origenId:    parseInt(idOrden),
          tipoDerivada: 'dano_oculto',
        },
      })
    } catch (err) {
      setErrorNav(err.message)
      setNavegando(false)
    }
  }

  if (!esSeguro) {
    return (
      <div style={s.seccionInterna}>
        <p style={s.label}>Esta orden es de cliente particular. Un daño oculto se tramita como una orden nueva vinculada a este mismo vehículo.</p>
        {errorNav && <p style={s.err}>{errorNav}</p>}
        <button onClick={irAOrdenDerivada} disabled={navegando} style={navegando ? s.btnDisabled : s.btnPrimary}>
          {navegando ? 'Cargando...' : 'Crear orden derivada de daño oculto →'}
        </button>
      </div>
    )
  }

  return (
    <div style={s.seccionInterna}>
      <div style={s.dosColumnas}>
        <form onSubmit={handleSubmit} style={s.form}>
          <Campo label="Descripción" required>
            <input type="text" value={form.descripcion}
              onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              placeholder="Ej: Daño en chasis oculto bajo moldura" style={s.input} required
              onFocus={e => Object.assign(e.target.style, s.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, s.input)} />
          </Campo>
          <Campo label="Costo adicional (C$)" required>
            <input type="number" min="0" step="0.01" value={form.costo_adicional}
              onChange={e => setForm(p => ({ ...p, costo_adicional: e.target.value }))}
              placeholder="Ej: 3500.00" style={s.input} required
              onFocus={e => Object.assign(e.target.style, s.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, s.input)} />
          </Campo>
          <label style={s.checkRow}>
            <input type="checkbox" checked={form.aplica_seguro}
              onChange={e => setForm(p => ({ ...p, aplica_seguro: e.target.checked }))} style={s.chk} />
            <span style={s.label}>Aplica <span style={s.accent}>seguro</span></span>
          </label>
          {form.aplica_seguro && (
            <>
              <Campo label="Monto cubierto por seguro (C$)">
                <input type="number" min="0" step="0.01" value={form.monto_cubierto_seguro}
                  onChange={e => setForm(p => ({ ...p, monto_cubierto_seguro: e.target.value }))}
                  style={s.input}
                  onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                  onBlur={e  => Object.assign(e.target.style, s.input)} />
              </Campo>
              <Campo label="Monto extra al cliente (C$)">
                <input type="number" min="0" step="0.01" value={form.monto_extra_cliente}
                  onChange={e => setForm(p => ({ ...p, monto_extra_cliente: e.target.value }))}
                  style={s.input}
                  onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                  onBlur={e  => Object.assign(e.target.style, s.input)} />
              </Campo>
            </>
          )}
          {error && <p style={s.err}>{error}</p>}
          <button type="submit" disabled={creando} style={creando ? s.btnDisabled : s.btnPrimary}>
            {creando ? 'Registrando...' : 'Registrar daño oculto'}
          </button>
        </form>

        <div>
          <p style={s.seccionSubtitulo}>Daños registrados</p>
          {danos.length === 0
            ? <p style={s.vacio}>Sin daños ocultos registrados.</p>
            : danos.map(d => (
              <div key={d.id} style={{ ...s.filaItem, flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                <span style={s.itemDesc}>{d.descripcion}</span>
                <span style={s.itemVal}>C$ {fmt(d.costo_adicional)}</span>
                <span style={{
                  ...s.itemMeta,
                  color: d.estado_aprobacion === 'aprobado' ? 'var(--success)'
                       : d.estado_aprobacion === 'rechazado' ? 'var(--danger)'
                       : 'var(--yellow-400)',
                }}>
                  {d.estado_aprobacion}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── modal de pago ────────────────────────────────────────────────────────────
function ModalPago({ idOrden, onCerrar, navigate }) {
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <p style={s.modalTitulo}>¿Deseás ingresar un pago?</p>
        <p style={s.modalTexto}>La operación se registró correctamente. Podés ingresar un pago ahora o volver a las operaciones.</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate(`/ordenes/${idOrden}/pago`)} style={s.btnPrimary}>Ingresar pago →</button>
          <button onClick={onCerrar} style={s.btnSecondary}>Volver a operaciones</button>
        </div>
      </div>
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function Operaciones() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [orden, setOrden]               = useState(null)
  const [totales, setTotales]           = useState(null)
  const [loading, setLoading]           = useState(true)
  const [seccionAbierta, setSeccion]    = useState(null)
  const [mostrarModalPago, setModalPago] = useState(false)

  useEffect(() => {
    async function cargar() {
      const headers = { Authorization: `Bearer ${getToken()}` }
      const res = await fetch(`${API}/api/ordenes/${id}`, { headers })
      if (res.ok) setOrden(await res.json())

      // recalcular totales al entrar — sincroniza datos inorgánicos o desactualizados
      const rTotales = await fetch(`${API}/api/operaciones/${id}/recalcular`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      })
      if (rTotales.ok) setTotales(await rTotales.json())

      setLoading(false)
    }
    cargar()
  }, [id])

  function actualizarTotales() {
    fetch(`${API}/api/operaciones/${id}/recalcular`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTotales(data) })
  }

  function toggle(nombre) { setSeccion(prev => prev === nombre ? null : nombre) }
  function operacionHecha() { setModalPago(true); actualizarTotales() }

  if (loading) return <div style={s.page}><p style={{ color: 'var(--neutral-300)', padding: '2rem' }}>Cargando orden...</p></div>
  if (!orden)  return <div style={s.page}><p style={{ color: 'var(--danger)', padding: '2rem' }}>Orden no encontrada.</p></div>

  return (
    <div style={s.page}>
      {mostrarModalPago && (
        <ModalPago idOrden={id} onCerrar={() => setModalPago(false)} navigate={navigate} />
      )}
      <div style={s.container}>

        <div style={s.header}>
          <div>
            <span style={s.eyebrow}>Operaciones — Orden #{id}</span>
            <h1 style={s.titulo}>Orden <span style={s.accent}>#{id}</span></h1>
          </div>
          <button onClick={() => navigate('/ordenes')} style={s.btnSecondary}>← Ver órdenes</button>
        </div>

        <EncabezadoOrden orden={orden} />

        {/* ── card de totales ── */}
        {totales && (
          <div style={s.totalesCard}>
            <div style={s.totalesItem}>
              <span style={s.totalesLabel}>Subtotal</span>
              <span style={s.totalesValor}>C$ {fmt(totales.subtotal)}</span>
            </div>
            <div style={s.totalesSep} />
            <div style={s.totalesItem}>
              <span style={s.totalesLabel}>IVA (15%)</span>
              <span style={s.totalesValor}>C$ {fmt(totales.iva)}</span>
            </div>
            <div style={s.totalesSep} />
            <div style={s.totalesItem}>
              <span style={s.totalesLabel}>Total</span>
              <span style={{ ...s.totalesValor, color: 'var(--yellow-400)', fontSize: 'var(--text-body-lg)' }}>
                C$ {fmt(totales.costo_total)}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Seccion titulo="Servicios / Líneas de cobro" abierta={seccionAbierta === 'servicios'} onToggle={() => toggle('servicios')}>
            <SeccionServicios idOrden={id} onOperacionHecha={operacionHecha} />
          </Seccion>

          <Seccion titulo="Materiales + Personal" abierta={seccionAbierta === 'materiales'} onToggle={() => toggle('materiales')}>
            <SeccionMateriales idOrden={id} onOperacionHecha={operacionHecha} />
          </Seccion>

          <Seccion titulo="Repuestos + Personal" abierta={seccionAbierta === 'repuestos'} onToggle={() => toggle('repuestos')}>
            <SeccionRepuestos idOrden={id} onOperacionHecha={operacionHecha} />
          </Seccion>

          <Seccion titulo="Daños ocultos" abierta={seccionAbierta === 'danos'} onToggle={() => toggle('danos')}>
            <SeccionDanos idOrden={id} tipoPago={orden.tipo_pago} onOperacionHecha={operacionHecha} navigate={navigate} />
          </Seccion>

          <Seccion titulo="Media (fotos / documentos)" abierta={seccionAbierta === 'media'} onToggle={() => toggle('media')}>
            <div style={s.seccionInterna}>
              <p style={s.vacio}>Esta sección estará disponible en el próximo informe — requiere integración con Cloudflare R2.</p>
            </div>
          </Seccion>
        </div>

      </div>
    </div>
  )
}

const s = {
  page:             { minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' },
  container:        { width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  header:           { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrow:          { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--neutral-300)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  titulo:           { fontSize: 'var(--text-title)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, lineHeight: 1.1 },
  accent:           { color: 'var(--yellow-500)' },
  encabezado:       { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  encIzq:           { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  encDer:           { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  encSub:           { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  matricula:        { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)' },
  estadoBadge:      { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-full)', border: '1px solid', textTransform: 'capitalize' },
  tipoBadge:        { fontSize: 'var(--text-xs)', color: 'var(--blue-300)', backgroundColor: 'rgba(51,133,214,0.1)', border: '1px solid rgba(51,133,214,0.25)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontWeight: 'var(--weight-medium)', textTransform: 'capitalize' },
  seccion:          { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  seccionAbierta:   { backgroundColor: 'var(--surface)', border: '1px solid var(--yellow-500)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--glow-yellow)' },
  seccionBtn:       { width: '100%', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '1.1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  seccionTitulo:    { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)' },
  seccionChevron:   { fontSize: 'var(--text-small)', color: 'var(--neutral-400)' },
  seccionBody:      { padding: '0 1.5rem 1.5rem' },
  seccionInterna:   { display: 'flex', flexDirection: 'column', gap: '1rem' },
  seccionSubtitulo: { fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' },
  dosColumnas:      { display: 'flex', gap: '2rem', alignItems: 'flex-start' },
  form:             { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  input:            { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', transition: 'border-color 0.15s' },
  inputFocus:       { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--yellow-500)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxShadow: 'var(--glow-yellow)' },
  label:            { fontSize: 'var(--text-small)', color: 'var(--neutral-200)', fontWeight: 'var(--weight-medium)' },
  checkRow:         { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
  chk:              { width: '15px', height: '15px', accentColor: 'var(--yellow-500)', cursor: 'pointer' },
  fijosRow:         { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  fijoBtn:          { backgroundColor: 'var(--surface-raised)', color: 'var(--neutral-200)', fontSize: 'var(--text-small)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', cursor: 'pointer' },
  fijoActivo:       { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer' },
  filaItem:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' },
  filaItemMain:     { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 },
  itemDesc:         { fontSize: 'var(--text-body)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)' },
  itemVal:          { fontSize: 'var(--text-small)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  itemMeta:         { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  ivaOn:            { fontSize: 'var(--text-xs)', color: 'var(--success)', fontWeight: 'var(--weight-medium)' },
  ivaOff:           { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' },
  btnPrimary:       { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  btnSecondary:     { backgroundColor: 'var(--surface-raised)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },
  btnDisabled:      { backgroundColor: 'var(--surface)', color: 'var(--neutral-400)', fontSize: 'var(--text-body)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.5 },
  btnGhost:         { backgroundColor: 'transparent', color: 'var(--blue-300)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.35rem 0', border: 'none', cursor: 'pointer', textAlign: 'left' },
  btnX:             { backgroundColor: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-sm)', flexShrink: 0 },
  err:              { fontSize: 'var(--text-small)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', margin: 0 },
  vacio:            { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', margin: 0, fontStyle: 'italic' },
  totalesCard:      { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' },
  totalesItem:      { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  totalesLabel:     { fontSize: 'var(--text-xs)', color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--weight-medium)' },
  totalesValor:     { fontSize: 'var(--text-body)', color: 'var(--foreground)', fontWeight: 'var(--weight-bold)' },
  totalesSep:       { width: '1px', height: '32px', backgroundColor: 'var(--border)', flexShrink: 0 },
  overlay:          { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:            { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', maxWidth: '440px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  modalTitulo:      { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0 },
  modalTexto:       { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 },
}