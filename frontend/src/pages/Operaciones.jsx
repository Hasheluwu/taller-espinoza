import WorkersPicker from '../components/WorkersPicker'
import { emptyWorkerRow, workersPayload, ROLE_LABELS } from '../lib/workers'
import { workshopApi } from '../lib/workshopApi'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { apiFetch } from '../lib/api'
// frontend/src/pages/Operaciones.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = ''
const fmt = n => Number(n).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Estados en los que se permite eliminar líneas
const ESTADOS_EDITABLES = ['recibido', 'en_proceso']

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

// ─── botón X con lógica de estado editable ────────────────────────────────────
function BtnEliminar({ estadoOrden, onClick, title }) {
  const editable = ESTADOS_EDITABLES.includes(estadoOrden)
  const tooltip  = editable
    ? (title || 'Eliminar')
    : `No se puede eliminar en estado "${estadoOrden.replace('_', ' ')}"`

  return (
    <button
      onClick={editable ? onClick : undefined}
      disabled={!editable}
      title={tooltip}
      style={editable ? s.btnX : s.btnXDisabled}
    >
      ✕
    </button>
  )
}

// ─── sección servicios ────────────────────────────────────────────────────────
function SeccionServicios({ idOrden, estadoOrden, onOperacionHecha, onTotalesActualizados }) {
  const [servicios, setServicios] = useState([])
  const [form, setForm]           = useState({ descripcion: '', precio: '', aplica_iva: true, tipo_linea: 'servicio' })
  const [creando, setCreando]     = useState(false)
  const [error, setError]         = useState('')

  const cargar = useCallback(async () => {
    try {
    const res  = await apiFetch(`${API}/api/operaciones/${idOrden}/servicios`, { headers: { Authorization: `Bearer ${getToken()}` } })
    const data = await res.json()
    if (res.ok) setServicios(data)
    } catch (err) { setError(err.message) }
  }, [idOrden])
  useDeferredLoad(cargar)

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setCreando(true)
    try {
      const res  = await apiFetch(`${API}/api/operaciones/${idOrden}/servicios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      setServicios(prev => [...prev, data])
      setForm({ descripcion: '', precio: '', aplica_iva: true, tipo_linea: 'servicio' })
      onOperacionHecha()
    } catch { setError('Error de conexión.') }
    finally { setCreando(false) }
  }

  async function handleEliminar(id) {
    setError('')
    const res = await apiFetch(`${API}/api/operaciones/servicios/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.ok) {
      setServicios(prev => prev.filter(sv => sv.id !== id))
      onTotalesActualizados()
    } else {
      const data = await res.json()
      setError(data.message || 'No se pudo eliminar el servicio.')
    }
  }

  return (
    <div style={s.seccionInterna}>
      <div style={s.dosColumnas}>
        <div>
          <form onSubmit={handleSubmit} style={s.form}>
            <label style={s.labelSmall}>Tipo de cargo<select value={form.tipo_linea} onChange={e=>setForm(p=>({...p,tipo_linea:e.target.value}))}><option value="servicio">Mano de obra</option><option value="repuesto">Repuesto</option><option value="material">Material</option></select></label>
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
                <BtnEliminar estadoOrden={estadoOrden} onClick={() => handleEliminar(sv.id)} />
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── sección equipo de la orden ──────────────────────────────────────────────
// Workers of this order, each once, with the amount agreed. Only they can use its materials.
function SeccionEquipo({ idOrden, estadoOrden, onEquipoCambio }) {
  const [equipo, setEquipo]               = useState([])
  const [personalLista, setPersonalLista] = useState([])
  const [workers, setWorkers]             = useState(() => [emptyWorkerRow()])
  const [editando, setEditando]           = useState(null)
  const [montoEdit, setMontoEdit]         = useState('')
  const [error, setError]                 = useState('')
  const [mensaje, setMensaje]             = useState('')
  const [creando, setCreando]             = useState(false)
  const editable = ESTADOS_EDITABLES.includes(estadoOrden)

  const cargar = useCallback(async () => {
    try {
      const [team, lista] = await Promise.all([workshopApi(`/api/operaciones/${idOrden}/personal`), workshopApi('/api/operaciones/personal/lista')])
      setEquipo(team); setPersonalLista(lista)
    } catch (err) { setError(err.message) }
  }, [idOrden])
  useDeferredLoad(cargar)

  async function ejecutar(accion, ok) {
    if (creando) return
    setCreando(true); setError(''); setMensaje('')
    try { await accion(); await cargar(); onEquipoCambio(); setMensaje(ok) }
    catch (err) { setError(err.message) }
    finally { setCreando(false) }
  }
  const agregar = () => ejecutar(async () => {
    const trabajadores = workersPayload(workers, { requireAmount: true })
    if (!trabajadores.length) throw new Error('Elige al menos un trabajador y su monto acordado.')
    await workshopApi(`/api/operaciones/${idOrden}/personal`, 'POST', { trabajadores })
    setWorkers([emptyWorkerRow()])
  }, 'Equipo actualizado.')
  const guardarMonto = id => ejecutar(async () => {
    await workshopApi(`/api/operaciones/personal-asignado/${id}`, 'PUT', { monto_acordado: montoEdit })
    setEditando(null)
  }, 'Monto actualizado.')
  const quitar = miembro => {
    if (!window.confirm(`¿Quitar a ${miembro.nombre_personal} del equipo de esta orden?`)) return
    ejecutar(() => workshopApi(`/api/operaciones/personal-asignado/${miembro.id}`, 'DELETE'), `${miembro.nombre_personal} salió del equipo.`)
  }

  const enEquipo = equipo.filter(m => !Number(m.liquidado)).map(m => m.id_personal)
  const total = equipo.reduce((sum, m) => sum + Number(m.monto_acordado || 0), 0)

  return (
    <div style={s.seccionInterna}>
      <div style={s.dosColumnas}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={s.seccionSubtitulo}>Agregar al equipo</p>
          {editable ? <>
            <WorkersPicker personalLista={personalLista} blocked={enEquipo} onWorkerCreated={w => setPersonalLista(prev => [w, ...prev])} rows={workers} setRows={setWorkers}
              amountHint="Elige quiénes trabajan en esta orden y cuánto se acordó con cada uno (puedes poner 0 y editarlo después). Solo ellos podrán usar materiales del inventario para esta orden."/>
            {error && <p style={s.err}>{error}</p>}
            {mensaje && <p className="team-ok" role="status">{mensaje}</p>}
            <button type="button" onClick={agregar} disabled={creando || !workers.some(w => w.id_personal)} style={creando ? s.btnDisabled : s.btnPrimary}>
              {creando ? 'Guardando...' : 'Agregar al equipo'}
            </button>
          </> : <p style={s.vacio}>La orden está {String(estadoOrden).replaceAll('_', ' ')}: su equipo ya no se puede cambiar.</p>}
        </div>

        <div>
          <p style={s.seccionSubtitulo}>Equipo de esta orden</p>
          {equipo.length === 0
            ? <p className="team-empty">Sin trabajadores asignados. Agrega al equipo antes de usar materiales del inventario.</p>
            : <ul className="team-list">{equipo.map(m => <li key={m.id}>
              <div className="team-main"><strong>{m.nombre_personal}</strong><span>{ROLE_LABELS[m.rol] || m.rol}{Number(m.liquidado) ? ' · Liquidado' : ''}</span></div>
              {editando === m.id
                ? <div className="team-edit"><input type="number" min="0" step="0.01" value={montoEdit} onChange={e => setMontoEdit(e.target.value)} aria-label={`Monto acordado con ${m.nombre_personal}`} autoFocus/><button type="button" onClick={() => guardarMonto(m.id)} disabled={creando || montoEdit === ''}>Guardar</button><button type="button" onClick={() => setEditando(null)}>Cancelar</button></div>
                : <div className="team-amount"><b>C$ {fmt(m.monto_acordado)}</b>{editable && !Number(m.liquidado) && <>
                    <button type="button" className="team-link" onClick={() => { setEditando(m.id); setMontoEdit(String(m.monto_acordado)) }}>Editar monto</button>
                    <button type="button" className="team-link team-remove" onClick={() => quitar(m)}>Quitar</button>
                  </>}</div>}
            </li>)}</ul>}
          {equipo.length > 0 && <p className="team-total">Mano de obra acordada: <b>C$ {fmt(total)}</b></p>}
        </div>
      </div>
    </div>
  )
}

// ─── sección materiales ──────────────────────────────────────────────────────
function SeccionMateriales({ idOrden, estadoOrden, equipoVersion, onAbrirEquipo, onOperacionHecha, onTotalesActualizados }) {
  const [materiales, setMateriales]       = useState([])
  const [equipo, setEquipo]               = useState([])
  const [inventario, setInventario]       = useState([])
  const [formMat, setFormMat]             = useState({ id_material: '', cantidad_usada: '', id_personal: '', nota: '' })
  const [error, setError]                 = useState('')
  const [creando, setCreando]             = useState(false)

  const cargarTodo = useCallback(async () => {
    try {
      const [mats, team, inv] = await Promise.all([
        workshopApi(`/api/operaciones/${idOrden}/materiales`),
        workshopApi(`/api/operaciones/${idOrden}/personal`),
        workshopApi('/api/operaciones/inventario/lista'),
      ])
      setMateriales(mats); setInventario(inv)
      setEquipo([...new Map(team.map(m => [m.id_personal, m])).values()])
    } catch (err) { setError(err.message) }
  }, [idOrden, equipoVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  useDeferredLoad(cargarTodo)

  async function handleSubmitMat(e) {
    e.preventDefault(); setError(''); setCreando(true)
    try {
      await workshopApi(`/api/operaciones/${idOrden}/materiales`, 'POST', formMat)
      await cargarTodo()
      setFormMat({ id_material: '', cantidad_usada: '', id_personal: '', nota: '' })
      onOperacionHecha()
    } catch (err) { setError(err.message) }
    finally { setCreando(false) }
  }

  async function handleEliminarMat(id) {
    setError('')
    try {
      await workshopApi(`/api/operaciones/materiales/${id}`, 'DELETE')
      setMateriales(prev => prev.filter(m => m.id !== id))
      onTotalesActualizados()
    } catch (err) { setError(err.message || 'No se pudo eliminar el material.') }
  }

  return (
    <div style={s.seccionInterna}>
      <div style={s.dosColumnas}>
        <form onSubmit={handleSubmitMat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={s.seccionSubtitulo}>Material</p>
          {equipo.length === 0 && <div className="team-warning" role="alert"><p>Esta orden no tiene equipo. Solo los trabajadores asignados pueden usar materiales.</p><button type="button" onClick={onAbrirEquipo}>Asignar equipo →</button></div>}
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
          <Campo label="Trabajador del equipo que lo usa" required>
            <select value={formMat.id_personal} onChange={e => setFormMat(p => ({ ...p, id_personal: e.target.value }))} style={s.input} required disabled={!equipo.length}>
              <option value="">{equipo.length ? 'Seleccioná trabajador...' : 'Primero asigna el equipo'}</option>
              {equipo.map(m => <option key={m.id_personal} value={m.id_personal}>{m.nombre_personal} ({ROLE_LABELS[m.rol] || m.rol})</option>)}
            </select>
          </Campo>
          <Campo label="Trabajo o nota · opcional">
            <input maxLength={500} value={formMat.nota} onChange={e => setFormMat(p => ({ ...p, nota: e.target.value }))} placeholder="Ej: Pintura de puerta trasera" style={s.input}/>
          </Campo>
          {error && <p style={s.err}>{error}</p>}
          <button type="submit" disabled={creando || !equipo.length} style={creando || !equipo.length ? s.btnDisabled : s.btnPrimary}>
            {creando ? 'Registrando...' : 'Registrar consumo'}
          </button>
        </form>

        <div>
          <p style={s.seccionSubtitulo}>Materiales registrados</p>
          {materiales.length === 0
            ? <p style={s.vacio}>Sin materiales.</p>
            : materiales.map(m => (
              <div key={m.id} style={s.filaItem}>
                <div style={s.filaItemMain}>
                  <span style={s.itemDesc}>{m.nombre_material}</span>
                  {m.responsable && <span style={s.itemMeta}>Usado por {m.responsable}{m.nota ? ` · ${m.nota}` : ''}</span>}
                  <span style={s.itemVal}>×{m.cantidad_usada} {m.unidad_medida}</span>
                  <span style={s.itemVal}>C$ {fmt(m.precio_unitario)}</span>
                </div>
                <BtnEliminar estadoOrden={estadoOrden} onClick={() => handleEliminarMat(m.id)} />
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── sección repuestos ───────────────────────────────────────────────────────
function SeccionRepuestos({ idOrden, onOperacionHecha }) {
  const [repuestos, setRepuestos]         = useState([])
  const [lista, setLista]                 = useState([])
  const [formRep, setFormRep]             = useState({ id_repuesto: '', cantidad_usada: '' })
  const [error, setError]                 = useState('')
  const [creando, setCreando]             = useState(false)

  const cargarTodo = useCallback(async () => {
    try {
      const [reps, disponibles] = await Promise.all([workshopApi(`/api/operaciones/${idOrden}/repuestos`), workshopApi('/api/operaciones/repuestos/lista')])
      setRepuestos(reps); setLista(disponibles)
    } catch (err) { setError(err.message) }
  }, [idOrden])
  useDeferredLoad(cargarTodo)

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setCreando(true)
    try {
      await workshopApi(`/api/operaciones/${idOrden}/repuestos`, 'POST', formRep)
      setFormRep({ id_repuesto: '', cantidad_usada: '' })
      await cargarTodo()
      onOperacionHecha()
    } catch (err) { setError(err.message) }
    finally { setCreando(false) }
  }

  return (
    <div style={s.seccionInterna}>
      <div style={s.dosColumnas}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={s.seccionSubtitulo}>Repuesto</p>
          <p style={s.vacio}>La mano de obra se acuerda en Equipo de la orden.</p>
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
          {error && <p style={s.err}>{error}</p>}
          <button type="submit" disabled={creando} style={creando ? s.btnDisabled : s.btnPrimary}>
            {creando ? 'Registrando...' : 'Registrar repuesto'}
          </button>
        </form>

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

  const cargar = useCallback(async () => {
    try {
    const res = await apiFetch(`${API}/api/operaciones/${idOrden}/danos`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (res.ok) setDanos(await res.json())
    } catch (err) { setError(err.message) }
  }, [idOrden])
  useDeferredLoad(cargar)

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setCreando(true)
    try {
      const res  = await apiFetch(`${API}/api/operaciones/${idOrden}/danos`, {
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
      const res = await apiFetch(`${API}/api/ordenes/${idOrden}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('No se pudo cargar la orden.')
      const orden = await res.json()

      const cliente  = {
        id:       orden.id_cliente,
        nombre:   orden.nombre_cliente,
        cedula:   orden.cedula,
        telefono: orden.telefono,
      }
      const vehiculo = {
        id:               orden.id_vehiculo,
        matricula:        orden.matricula,
        marca:            orden.marca,
        modelo:           orden.modelo,
        anio_fabricacion: orden.anio_fabricacion,
        // FIX: el endpoint GET /api/ordenes/:id devuelve el campo como
        // 'aseguradora' (del JOIN con vehiculo). Ajustar si tu ordenes.js
        // usa un alias distinto — verificar el SELECT en ese archivo.
        aseguradora:      orden.aseguradora ?? 'ninguna',
        color:            orden.color,
      }

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

  const [orden, setOrden]                = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [totales, setTotales]            = useState(null)
  const [loading, setLoading]            = useState(true)
  const [searchParams]                   = useSearchParams()
  const [seccionAbierta, setSeccion]     = useState(() => searchParams.get('seccion'))
  const [equipoVersion, setEquipoVersion] = useState(0)
  const [mostrarModalPago, setModalPago] = useState(false)

  useEffect(() => {
    async function cargar() {
      try {
      const headers = { Authorization: `Bearer ${getToken()}` }
      const res = await apiFetch(`${API}/api/ordenes/${id}`, { headers })
      const dataOrden = await res.json()
      if (!res.ok) throw new Error(dataOrden.message || 'No se pudo cargar la orden.')
      setOrden(dataOrden)

      const rTotales = await apiFetch(`${API}/api/operaciones/${id}/recalcular`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      })
      const dataTotales = await rTotales.json()
      if (!rTotales.ok) throw new Error(dataTotales.message || 'No se pudieron cargar los totales.')
      setTotales(dataTotales)

      } catch (err) { setErrorCarga(err.message) }
      finally { setLoading(false) }
    }
    cargar()
  }, [id])

  function actualizarTotales() {
    apiFetch(`${API}/api/operaciones/${id}/recalcular`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTotales(data) })
      .catch(err => setErrorCarga(err.message))
  }

  function toggle(nombre) { setSeccion(prev => prev === nombre ? null : nombre) }
  async function operacionHecha() {
    actualizarTotales()
    try {
      const res = await apiFetch(`/api/pagos/${id}/resumen`, { headers: { Authorization: `Bearer ${getToken()}` } })
      const balance = await res.json()
      if (!res.ok) throw new Error(balance.message)
      setModalPago(balance.puede_cobrar_cliente || balance.puede_cobrar_seguro)
    } catch (err) { setErrorCarga(err.message) }
  }

  if (loading) return <div style={s.page}><p style={{ color: 'var(--neutral-300)', padding: '2rem' }}>Cargando orden...</p></div>
  if (errorCarga) return <div style={s.page}><p role="alert" className="login-error">{errorCarga}</p><button className="btn-cyber-outline" onClick={() => navigate('/ordenes')}>Volver a órdenes</button></div>
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
        {orden.detalle_particular?.observaciones && <section style={{ ...s.seccion, padding: '1.5rem' }}><h2 style={s.seccionTitulo}>Observaciones del trabajo particular</h2><p style={{ whiteSpace: 'pre-wrap' }}>{orden.detalle_particular.observaciones}</p></section>}

        {!!orden?.cargos_desde_proforma && (
          <div className="pf-info">
            {orden.detalle_particular
              ? 'Los trabajos y sus importes se registraron al crear este trabajo particular.'
              : Number(orden.id_presupuesto) > 0
                ? 'Los cargos aprobados se trasladaron desde la proforma.'
                : 'Los trabajos y sus importes ya están incluidos en esta orden.'}
            {' '}Materiales y repuestos registran el consumo sin volver a cobrarse. Para un cargo adicional usa «Servicios / Líneas de cobro».
            {!orden.detalle_particular && Number.isSafeInteger(Number(orden.id_presupuesto)) && Number(orden.id_presupuesto) > 0 && (
              <button className="pf-text-link" onClick={() => navigate(`/proformas/${orden.id_presupuesto}`)}>Ver proforma →</button>
            )}
          </div>
        )}
        <button onClick={() => navigate(`/ordenes/${id}/expediente`)} style={s.btnSecondary}>Fotos, costos y entrega</button>

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
            <SeccionServicios
              idOrden={id}
              estadoOrden={orden.estado}
              onOperacionHecha={operacionHecha}
              onTotalesActualizados={actualizarTotales}
            />
          </Seccion>

          <Seccion titulo="Equipo de la orden" abierta={seccionAbierta === 'equipo'} onToggle={() => toggle('equipo')}>
            <SeccionEquipo idOrden={id} estadoOrden={orden.estado} onEquipoCambio={() => setEquipoVersion(v => v + 1)} />
          </Seccion>

          <Seccion titulo="Materiales" abierta={seccionAbierta === 'materiales'} onToggle={() => toggle('materiales')}>
            <SeccionMateriales
              idOrden={id}
              estadoOrden={orden.estado}
              equipoVersion={equipoVersion}
              onAbrirEquipo={() => setSeccion('equipo')}
              onOperacionHecha={operacionHecha}
              onTotalesActualizados={actualizarTotales}
            />
          </Seccion>

          <Seccion titulo="Repuestos" abierta={seccionAbierta === 'repuestos'} onToggle={() => toggle('repuestos')}>
            <SeccionRepuestos
              idOrden={id}
              estadoOrden={orden.estado}
              onOperacionHecha={operacionHecha}
              onTotalesActualizados={actualizarTotales}
            />
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
  btnXDisabled:     { backgroundColor: 'transparent', color: 'var(--neutral-500)', border: 'none', cursor: 'not-allowed', fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-sm)', flexShrink: 0, opacity: 0.35 },
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





