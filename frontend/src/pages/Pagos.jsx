import {InsuranceCorrection, InsuranceExcess} from '../components/InsuranceCorrection'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { localDateTime } from '../lib/date'
import { PaymentBalance, PaymentAllocation } from '../components/PaymentBalance'
import { apiFetch } from '../lib/api'
// frontend/src/pages/Pagos.jsx
import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API      = ''
const fmt = n =>
  Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-NI')
}

function fmtFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-NI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TIPO_COLORS = {
  adelanto:  { bg: 'rgba(51,133,214,0.12)',  color: '#3385d6', border: 'rgba(51,133,214,0.3)'  },
  abono:     { bg: 'rgba(255,195,0,0.12)',   color: '#FFC300', border: 'rgba(255,195,0,0.3)'   },
  saldo:     { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', border: 'rgba(34,197,94,0.3)'   },
  pendiente: { bg: 'rgba(255,195,0,0.12)',   color: '#FFC300', border: 'rgba(255,195,0,0.3)'   },
  recibido:  { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', border: 'rgba(34,197,94,0.3)'   },
}

function Badge({ texto }) {
  const st = TIPO_COLORS[texto] || TIPO_COLORS.pendiente
  return (
    <span style={{
      backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`,
      borderRadius: 'var(--radius-full)', padding: '0.15rem 0.55rem',
      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', textTransform: 'capitalize',
    }}>
      {texto}
    </span>
  )
}

// FIX: generarReciboPDF ahora recibe setError para informar si el navegador bloquea el popup.
function generarReciboPDF({ pago, orden, setError }) {
  const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  pago = Object.fromEntries(Object.entries(pago).map(([key, value]) => [key, typeof value === 'string' ? escape(value) : value]))
  orden = Object.fromEntries(Object.entries(orden || {}).map(([key, value]) => [key, typeof value === 'string' ? escape(value) : value]))
  const fecha = fmtFechaHora(pago.fecha)
  const monto = fmt(pago.monto)
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Recibo #${pago.numero_recibo || pago.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
    .logo { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #555; margin-bottom: 32px; }
    .titulo-recibo { font-size: 18px; font-weight: bold; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; }
    .fila { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .fila .label { color: #555; font-size: 13px; }
    .fila .valor { font-weight: bold; font-size: 13px; }
    .monto-grande { font-size: 28px; font-weight: bold; margin: 24px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 16px 0; }
    .footer { margin-top: 48px; font-size: 11px; color: #888; text-align: center; }
    .recibo-num { font-size: 11px; color: #999; margin-bottom: 24px; }
    .sello { margin-top: 48px; display: flex; gap: 48px; }
    .firma { flex: 1; border-top: 1px solid #999; padding-top: 8px; font-size: 11px; color: #555; }
  </style>
</head>
<body>
  <div class="logo">Taller Pedro Espinoza</div>
  <div class="subtitle">Taller de Enderezado y Pintura</div>
  <div class="titulo-recibo">Recibo de Pago</div>
  <div class="recibo-num">Recibo N° ${pago.numero_recibo || `AUTO-${pago.id}`} &nbsp;|&nbsp; Orden #${orden?.id || '—'}</div>
  <div class="fila"><span class="label">Cliente</span><span class="valor">${orden?.nombre_cliente || '—'}</span></div>
  <div class="fila"><span class="label">Cédula</span><span class="valor">${orden?.cedula || '—'}</span></div>
  <div class="fila"><span class="label">Vehículo</span><span class="valor">${orden?.marca || ''} ${orden?.modelo || ''} — ${orden?.matricula || '—'}</span></div>
  <div class="fila"><span class="label">Fecha de pago</span><span class="valor">${fecha}</span></div>
  <div class="fila"><span class="label">Tipo de pago</span><span class="valor">${(pago.tipo || '').toUpperCase()}</span></div>
  <div class="fila"><span class="label">Método</span><span class="valor">${(pago.metodo || '').toUpperCase()}</span></div>
  <div class="monto-grande">C$ ${monto}</div>
  <div class="sello">
    <div class="firma">Firma del cliente</div>
    <div class="firma">Firma de recibido</div>
  </div>
  <div class="footer">Este recibo es válido como comprobante de pago. Conserve para sus registros.</div>
</body>
</html>`
  const blob    = new Blob([html], { type: 'text/html' })
  const url     = URL.createObjectURL(blob)
  const ventana = window.open(url, '_blank')
  // FIX: si el navegador bloqueó el popup, informar al usuario en vez de silenciar el error
  if (!ventana && setError) {
    setError('El navegador bloqueó la ventana del recibo. Permitir popups para este sitio e intentar de nuevo.')
  } else if (ventana) {
    ventana.focus()
  }
}

// ─── campo helper ─────────────────────────────────────────────────────────────
function Campo({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={s.labelSmall}>
        <span style={{ color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' }}>{label}</span>
        {!required && <span style={s.opcional}> — opcional</span>}
      </label>
      {children}
    </div>
  )
}

// ─── modal de confirmación genérico ──────────────────────────────────────────
function ModalConfirmar({ titulo, mensaje, labelConfirmar = 'Eliminar', onConfirmar, onCancelar }) {
  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, borderColor: 'rgba(229,72,77,0.35)', maxWidth: '420px' }}>
        <p style={s.modalTitulo}>{titulo}</p>
        <p style={s.modalTexto}>{mensaje}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onConfirmar} style={s.btnEliminar}>{labelConfirmar}</button>
          <button onClick={onCancelar}  style={s.btnSecondary}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── formulario pago cliente ──────────────────────────────────────────────────
function FormPagoCliente({ idOrden, orden, saldo, onPagoCreado }) {
  const [form, setForm]       = useState({
    monto: '', fecha: localDateTime(),
    tipo: 'abono', metodo: 'efectivo', numero_recibo: '',
  })
  const [creando, setCreando] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault(); if (creando) return; setError('');
    if (!Number.isFinite(Number(form.monto)) || Number(form.monto) <= 0 || Number(form.monto) > saldo) { setError('El monto debe ser positivo y no superar el saldo disponible.'); return }
    setCreando(true)
    try {
      const res  = await apiFetch(`${API}/api/pagos/${idOrden}/cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al registrar pago.'); return }
      onPagoCreado(data)
      // FIX: pasar setError para que la función pueda reportar popup bloqueado
      generarReciboPDF({ pago: data, orden, setError })
      setForm({ monto: '', fecha: localDateTime(), tipo: 'abono', metodo: 'efectivo', numero_recibo: '' })
    } catch (err) { setError(err.message) }
    finally { setCreando(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <p style={s.formTitulo}>Pago del cliente</p>
      <div style={s.filaGrid2}>
        <Campo label="Monto (C$)" required>
          <input type="number" min="0.01" max={saldo} step="0.01" value={form.monto}
            onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
            placeholder="C$ 0.00" style={s.input} required
            onFocus={e => Object.assign(e.target.style, s.inputFocus)}
            onBlur={e  => Object.assign(e.target.style, s.input)} />
        </Campo>
        <Campo label="Fecha y hora" required>
          <input type="datetime-local" value={form.fecha}
            onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
            style={{ ...s.input, colorScheme: 'dark' }} required
            onFocus={e => Object.assign(e.target.style, s.inputFocus)}
            onBlur={e  => Object.assign(e.target.style, s.input)} />
        </Campo>
      </div>
      <div style={s.filaGrid2}>
        <Campo label="Tipo" required>
          <div style={s.radioGroup}>
            {['adelanto', 'abono', 'saldo'].map(op => (
              <label key={op} style={form.tipo === op ? s.radioBtnActivo : s.radioBtn}>
                <input type="radio" name="tipo_pago_cliente" value={op}
                  checked={form.tipo === op} onChange={() => setForm(p => ({ ...p, tipo: op }))}
                  style={{ display: 'none' }} />
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </label>
            ))}
          </div>
        </Campo>
        <Campo label="Método" required>
          <div style={s.radioGroup}>
            {['efectivo', 'transferencia', 'otro'].map(op => (
              <label key={op} style={form.metodo === op ? s.radioBtnActivo : s.radioBtn}>
                <input type="radio" name="metodo_pago_cliente" value={op}
                  checked={form.metodo === op} onChange={() => setForm(p => ({ ...p, metodo: op }))}
                  style={{ display: 'none' }} />
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </label>
            ))}
          </div>
        </Campo>
      </div>
      <Campo label="N° de recibo">
        <input type="text" value={form.numero_recibo}
          onChange={e => setForm(p => ({ ...p, numero_recibo: e.target.value }))}
          placeholder="Ej: R-00145 (del talonario físico)" style={s.input}
          onFocus={e => Object.assign(e.target.style, s.inputFocus)}
          onBlur={e  => Object.assign(e.target.style, s.input)} />
      </Campo>
      {error && <p style={s.err}>{error}</p>}
      <button type="submit" disabled={creando} style={creando ? s.btnDisabled : s.btnPrimary}>
        {creando ? 'Registrando...' : 'Registrar pago y descargar recibo →'}
      </button>
    </form>
  )
}

// ─── formulario pago seguro ───────────────────────────────────────────────────
function FormPagoSeguro({ idOrden, tipoPago, saldo, onPagoCreado }) {
  const [form, setForm]       = useState({
    monto: '', fecha_esperada: '', fecha_recibido: '',
    estado: 'pendiente', referencia_bancaria: '', concepto: 'pago_principal',
  })
  const [creando, setCreando] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault(); if (creando) return; setError('');
    if (!Number.isFinite(Number(form.monto)) || Number(form.monto) <= 0 || (Number(form.monto) > saldo && !form.confirmar_excedente)) { setError('El monto debe ser positivo y no superar el saldo disponible.'); return }
    setCreando(true)
    try {
      const res  = await apiFetch(`${API}/api/pagos/${idOrden}/seguro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al registrar pago.'); return }
      onPagoCreado(data)
      setForm({ monto: '', fecha_esperada: '', fecha_recibido: '', estado: 'pendiente', referencia_bancaria: '', concepto: 'pago_principal' })
    } catch (err) { setError(err.message) }
    finally { setCreando(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...s.form, backgroundColor: 'rgba(0,29,61,0.4)', borderColor: 'var(--blue-700)' }}>
      <p style={{ ...s.formTitulo, color: 'var(--blue-300)' }}>
        Cobro al seguro — {tipoPago?.toUpperCase()}
      </p>
      <InsuranceExcess value={form} onChange={setForm}/>
      <div style={s.filaGrid2}>
        <Campo label="Monto (C$)" required>
          <input type="number" min="0.01" max={form.confirmar_excedente ? undefined : saldo} step="0.01" value={form.monto}
            onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
            placeholder="C$ 0.00" style={s.input} required
            onFocus={e => Object.assign(e.target.style, s.inputFocus)}
            onBlur={e  => Object.assign(e.target.style, s.input)} />
        </Campo>
        <Campo label="Estado">
          <div style={s.radioGroup}>
            {['pendiente', 'recibido'].map(op => (
              <label key={op} style={form.estado === op ? s.radioBtnActivo : s.radioBtn}>
                <input type="radio" name="estado_seguro" value={op}
                  checked={form.estado === op} onChange={() => setForm(p => ({ ...p, estado: op }))}
                  style={{ display: 'none' }} />
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </label>
            ))}
          </div>
        </Campo>
      </div>
      <div style={s.filaGrid2}>
        <Campo label="Fecha esperada de cobro">
          <input type="date" value={form.fecha_esperada}
            onChange={e => setForm(p => ({ ...p, fecha_esperada: e.target.value }))}
            style={{ ...s.input, colorScheme: 'dark' }}
            onFocus={e => Object.assign(e.target.style, s.inputFocus)}
            onBlur={e  => Object.assign(e.target.style, s.input)} />
        </Campo>
        <Campo label="Fecha recibido">
          <input type="date" value={form.fecha_recibido}
            onChange={e => setForm(p => ({ ...p, fecha_recibido: e.target.value }))}
            style={{ ...s.input, colorScheme: 'dark' }}
            onFocus={e => Object.assign(e.target.style, s.inputFocus)}
            onBlur={e  => Object.assign(e.target.style, s.input)} />
        </Campo>
      </div>
      <Campo label="Referencia bancaria">
        <input type="text" value={form.referencia_bancaria}
          onChange={e => setForm(p => ({ ...p, referencia_bancaria: e.target.value }))}
          placeholder="Ej: TRF-20260801-00342" style={s.input}
          onFocus={e => Object.assign(e.target.style, s.inputFocus)}
          onBlur={e  => Object.assign(e.target.style, s.input)} />
      </Campo>
      <Campo label="Concepto" required>
        <select value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))} style={s.input}>
          <option value="pago_principal">Pago principal</option>
          <option value="dano_oculto">Daño oculto</option>
          <option value="otro">Otro</option>
        </select>
      </Campo>
      {error && <p style={s.err}>{error}</p>}
      <button type="submit" disabled={creando} style={creando ? s.btnDisabled : { ...s.btnPrimary, backgroundColor: 'var(--blue-700)', border: '1px solid var(--blue-600)' }}>
        {creando ? 'Registrando...' : 'Registrar cobro al seguro'}
      </button>
    </form>
  )
}

// ─── lista pagos cliente ──────────────────────────────────────────────────────
function ListaPagosCliente({ pagos, orden, onEliminar, puedeEliminar }) {
  const [confirmandoId, setConfirmandoId] = useState(null)
  // FIX: error inline en vez de alert()
  const [error, setError] = useState('')

  if (pagos.length === 0) return <p style={s.vacio}>Sin pagos registrados.</p>

  const pagoConfirmando = pagos.find(p => p.id === confirmandoId)

  return (
    <>
      {confirmandoId !== null && pagoConfirmando && (
        <ModalConfirmar
          titulo="Eliminar pago"
          mensaje={`¿Eliminar el pago de C$ ${fmt(pagoConfirmando.monto)} (${pagoConfirmando.tipo})? Esta acción no se puede deshacer.`}
          labelConfirmar="Sí, eliminar"
          onConfirmar={() => { onEliminar(confirmandoId, setError); setConfirmandoId(null) }}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}
      {error && <p role="alert" style={s.err}>{error}</p>}
      <div style={s.listaPagos}>
        {pagos.map(p => (
          <div key={p.id} style={s.filaPago}>
            <div style={s.filaPagoIzq}>
              <span style={s.pagoMonto}>C$ {fmt(p.monto)}</span>
              <span style={s.pagoMeta}>{fmtFechaHora(p.fecha)}</span>
            </div>
            <div style={s.filaPagoDer}>
              <Badge texto={p.tipo} />
              <span style={s.pagoMetodo}>{p.metodo}</span>
              {p.numero_recibo && <span style={s.pagoRecibo}>#{p.numero_recibo}</span>}
              <button
                onClick={() => generarReciboPDF({ pago: p, orden, setError })}
                style={s.btnPDF}
                title="Imprimir recibo"
              >
                PDF
              </button>
              {puedeEliminar && <button onClick={() => setConfirmandoId(p.id)} style={s.btnX} title="Eliminar pago">✕</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── lista pagos seguro ───────────────────────────────────────────────────────
function ListaPagosSeguro({ pagos, onActualizar, onEliminar, puedeEliminar }) {
  const [editandoId, setEditandoId]       = useState(null)
  const [formEdit, setFormEdit]           = useState({ fecha_recibido: '', referencia_bancaria: '' })
  const [guardando, setGuardando]         = useState(false)
  const [error, setError] = useState('')
  const [confirmandoId, setConfirmandoId] = useState(null)

  async function marcarRecibido(pago) {
    setEditandoId(pago.id)
    setFormEdit({ fecha_recibido: localDateTime().slice(0, 10), referencia_bancaria: pago.referencia_bancaria || '' })
  }

  async function confirmarRecibido(id) {
    setGuardando(true)
    try {
      const res = await apiFetch(`${API}/api/pagos/seguro/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ estado: 'recibido', ...formEdit }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'No se pudo confirmar el cobro.')
      onActualizar(data); setEditandoId(null)
    } catch (err) { setError(err.message) } finally { setGuardando(false) }
  }

  if (pagos.length === 0) return <p style={s.vacio}>Sin cobros registrados al seguro.</p>

  const pagoConfirmando = pagos.find(p => p.id === confirmandoId)

  return (
    <>
      {confirmandoId !== null && pagoConfirmando && (
        <ModalConfirmar
          titulo="Eliminar cobro al seguro"
          mensaje={`¿Eliminar el cobro de C$ ${fmt(pagoConfirmando.monto)} (${pagoConfirmando.concepto?.replace('_', ' ')})? Esta acción no se puede deshacer.`}
          labelConfirmar="Sí, eliminar"
          onConfirmar={() => { onEliminar(confirmandoId); setConfirmandoId(null) }}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}
      {error && <p role="alert" style={s.err}>{error}</p>}
      <div style={s.listaPagos}>
        {pagos.map(p => (
          <div key={p.id} style={{ ...s.filaPago, flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div style={s.filaPagoIzq}>
                <span style={s.pagoMonto}>C$ {fmt(p.monto)}</span>
                <span style={s.pagoMeta}>
                  {p.concepto?.replace('_', ' ')}
                  {p.referencia_bancaria ? ` · Ref: ${p.referencia_bancaria}` : ''}
                </span>
                <span style={s.pagoMeta}>
                  {p.fecha_esperada ? `Esperado: ${fmtFecha(p.fecha_esperada)}` : ''}
                  {p.fecha_recibido ? ` · Recibido: ${fmtFecha(p.fecha_recibido)}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Badge texto={p.estado} />
                {p.estado === 'pendiente' && (
                  <button onClick={() => marcarRecibido(p)} style={s.btnRecibido}>Marcar recibido</button>
                )}
                {puedeEliminar && <button onClick={() => setConfirmandoId(p.id)} style={s.btnX}>✕</button>}
              </div>
            </div>
            <InsuranceCorrection payment={p} onSaved={onActualizar}/>
            {editandoId === p.id && (
              <div style={{...s.editSeguro, flexWrap: 'wrap'}}>
                <InsuranceExcess value={formEdit} onChange={setFormEdit}/>
                <input type="date" value={formEdit.fecha_recibido}
                  onChange={e => setFormEdit(f => ({ ...f, fecha_recibido: e.target.value }))}
                  style={{ ...s.input, colorScheme: 'dark', width: 'auto' }} />
                <input type="text" placeholder="Referencia bancaria (opcional)"
                  value={formEdit.referencia_bancaria}
                  onChange={e => setFormEdit(f => ({ ...f, referencia_bancaria: e.target.value }))}
                  style={{ ...s.input, flex: 1 }} />
                <button onClick={() => confirmarRecibido(p.id)} disabled={guardando} style={s.btnConfirmar}>
                  {guardando ? '...' : 'Confirmar'}
                </button>
                <button onClick={() => setEditandoId(null)} style={s.btnCancelar}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── modal entrega ────────────────────────────────────────────────────────────
function ModalEntrega({ idOrden, onCerrar, onEntregada }) {
  const [factura, setFactura]   = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')

  async function handleEntregar() {
    setEnviando(true); setError('')
    try {
      const res = await apiFetch(`${API}/api/pagos/${idOrden}/entregar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ numero_factura_fisica: factura }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      onEntregada(data)
    } catch { setError('Error de conexión.') }
    finally { setEnviando(false) }
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <p style={s.modalTitulo}>Marcar orden como <span style={{ color: '#22c55e' }}>Entregada</span></p>
        <p style={s.modalTexto}>Esta acción es definitiva. La orden pasará a estado "Entregado" y se registrará la fecha de entrega real.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={s.labelSmall}>N° de factura física <span style={s.opcional}>(opcional)</span></label>
          <input type="text" value={factura} onChange={e => setFactura(e.target.value)}
            placeholder="Ej: F-00234" style={s.input}
            onFocus={e => Object.assign(e.target.style, s.inputFocus)}
            onBlur={e  => Object.assign(e.target.style, s.input)} />
        </div>
        {error && <p style={s.err}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleEntregar} disabled={enviando} style={s.btnEntrega}>
            {enviando ? 'Procesando...' : 'Confirmar entrega'}
          </button>
          <button onClick={onCerrar} style={s.btnSecondary}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function Pagos() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [orden,    setOrden]    = useState(null)
  const [resumen,  setResumen]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [mostrarModalEntrega, setModalEntrega] = useState(false)
  const [entregada, setEntregada] = useState(false)

  const esSeguro = orden?.tipo_pago === 'lafise' || orden?.tipo_pago === 'iniser'

  const cargar = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` }
      const [rOrden, rResumen] = await Promise.all([
        apiFetch(`${API}/api/ordenes/${id}`, { headers }),
        apiFetch(`${API}/api/pagos/${id}/resumen`, { headers }),
      ])
      const dataOrden = await rOrden.json()
      const dataResumen = await rResumen.json()
      if (!rOrden.ok || !rResumen.ok) throw new Error(dataOrden.message || dataResumen.message || 'No se pudieron cargar los pagos.')
      setOrden(dataOrden)
      setResumen(dataResumen)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [id])

  useDeferredLoad(cargar, 0)

  function updateBalance(payment) { setResumen(payment.resumen) }
  const handlePagoClienteCreado = updateBalance
  const handlePagoSeguroCreado = updateBalance
  const handleActualizarSeguro = updateBalance

  async function eliminarPago(tipo, idPago, setErrorLocal = setError) {
    try {
      const res = await apiFetch(`/api/pagos/${tipo}/${idPago}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'No se pudo eliminar el pago.')
      setResumen(data.resumen)
    } catch (err) { setErrorLocal(err.message) }
  }
  const handleEliminarPagoCliente = (idPago, setErrorLocal) => eliminarPago('cliente', idPago, setErrorLocal)
  const handleEliminarPagoSeguro = idPago => eliminarPago('seguro', idPago)
  let esAdmin = false
  try { esAdmin = JSON.parse(atob(getToken().split('.')[1])).rol === 'administrador' } catch { /* API enforces permissions */ }
  const editable = ['recibido', 'en_proceso'].includes(orden?.estado)
  function handleEntregada() {
    setEntregada(true)
    setModalEntrega(false)
    setOrden(prev => ({ ...prev, estado: 'entregado' }))
  }

  if (loading) return (
    <div style={s.page}>
      <p style={{ color: 'var(--neutral-300)', padding: '3rem', textAlign: 'center' }}>Cargando datos de la orden...</p>
    </div>
  )

  if (error) return (
    <div style={s.page}>
      <p style={{ color: 'var(--danger)', padding: '3rem', textAlign: 'center' }}>{error}</p>
    </div>
  )

  return (
    <div style={s.page}>
      {mostrarModalEntrega && (
        <ModalEntrega idOrden={id} onCerrar={() => setModalEntrega(false)} onEntregada={handleEntregada} />
      )}
      <div style={s.container}>

        <div style={s.header}>
          <div>
            <span style={s.eyebrow}>Ruta 4 — Pagos · Orden #{id}</span>
            <h1 style={s.titulo}>Pagos — <span style={s.accent}>Orden #{id}</span></h1>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={() => navigate(`/ordenes/${id}/operaciones`)} style={s.btnSecondary}>Operaciones</button>
            <button onClick={() => navigate(`/ordenes/${id}/expediente`)} style={s.btnSecondary}>Fotos y costos</button>
            <button onClick={() => navigate('/ordenes')} style={s.btnSecondary}>← Ver órdenes</button>
          </div>
        </div>

        {orden && (
          <div style={s.encabezado}>
            <div style={s.encIzq}>
              <span style={s.matricula}>{orden.matricula}</span>
              <span style={s.encSub}>{orden.marca} {orden.modelo} {orden.anio_fabricacion}</span>
              <span style={s.encSub}>{orden.nombre_cliente} — {orden.cedula}</span>
            </div>
            <div style={s.encDer}>
              {['tipo', 'tipo_pago', 'estado'].map(campo => (
                <span key={campo} style={s.encBadge}>{orden[campo]?.replace('_', ' ')}</span>
              ))}
              {orden.estado !== 'entregado' && orden.estado !== 'cancelado' && !entregada && (
                <button onClick={() => setModalEntrega(true)} style={s.btnEntregar}>
                  Marcar como entregado ✓
                </button>
              )}
              {(orden.estado === 'entregado' || entregada) && (
                <span style={s.encBadgeEntregado}>✓ Entregado</span>
              )}
            </div>
          </div>
        )}

        <PaymentBalance resumen={resumen} esSeguro={esSeguro} />
        {esSeguro && resumen && !resumen.configurado && editable && <PaymentAllocation idOrden={id} resumen={resumen} onSaved={setResumen} />}

        <div style={{ ...s.dosColumnas, gridTemplateColumns: resumen?.pagado ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
          {(resumen?.puede_cobrar_cliente || resumen?.puede_cobrar_seguro) && <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {resumen?.puede_cobrar_cliente && <FormPagoCliente idOrden={id} orden={orden} saldo={resumen.saldo_cliente} onPagoCreado={handlePagoClienteCreado} />}
            {esSeguro && resumen?.puede_cobrar_seguro && (
              <FormPagoSeguro idOrden={id} saldo={resumen?.disponible_seguro} tipoPago={orden?.tipo_pago} onPagoCreado={handlePagoSeguroCreado} />
            )}
          </div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={s.historialBloque}>
              <p style={s.historialTitulo}>Pagos del cliente</p>
              <ListaPagosCliente
                pagos={resumen?.pagos_cliente || []}
                orden={orden}
                onEliminar={handleEliminarPagoCliente} puedeEliminar={esAdmin && editable && !resumen?.cliente_pagado}
              />
            </div>
            {esSeguro && (
              <div style={{ ...s.historialBloque, borderColor: 'var(--blue-700)' }}>
                <p style={{ ...s.historialTitulo, color: 'var(--blue-300)' }}>
                  Cobros al seguro — {orden?.tipo_pago?.toUpperCase()}
                </p>
                <ListaPagosSeguro
                  pagos={resumen?.pagos_seguro || []}
                  onActualizar={handleActualizarSeguro}
                  onEliminar={handleEliminarPagoSeguro} puedeEliminar={esAdmin && editable && !resumen?.seguro_pagado}
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

const s = {
  page:              { minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' },
  container:         { width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  header:            { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' },
  eyebrow:           { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--neutral-300)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  titulo:            { fontSize: 'var(--text-title)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, lineHeight: 1.1 },
  accent:            { color: 'var(--yellow-500)' },
  encabezado:        { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' },
  encIzq:            { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  encDer:            { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  encSub:            { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  matricula:         { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)' },
  encBadge:          { fontSize: 'var(--text-xs)', color: 'var(--neutral-200)', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.6rem', fontWeight: 'var(--weight-medium)', textTransform: 'capitalize' },
  encBadgeEntregado: { fontSize: 'var(--text-xs)', color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.6rem', fontWeight: 'var(--weight-bold)' },
  resumenGrid:       { display: 'flex', gap: '0', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', flexWrap: 'wrap' },
  resumenBloque:     { flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '1.25rem 1.5rem', borderRight: '1px solid var(--border)' },
  resumenLabel:      { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--weight-medium)' },
  resumenMonto:      { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)' },
  dosColumnas:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'flex-start' },
  form:              { display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' },
  formTitulo:        { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' },
  filaGrid2:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  labelSmall:        { fontSize: 'var(--text-small)', color: 'var(--neutral-200)', fontWeight: 'var(--weight-medium)' },
  opcional:          { color: 'var(--neutral-400)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-regular)' },
  input:             { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', transition: 'border-color 0.15s' },
  inputFocus:        { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--yellow-500)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxShadow: 'var(--glow-yellow)' },
  radioGroup:        { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  radioBtn:          { backgroundColor: 'var(--surface-raised)', color: 'var(--neutral-300)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.45rem 0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },
  radioBtnActivo:    { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', padding: '0.45rem 0.875rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  historialBloque:   { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  historialTitulo:   { fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' },
  listaPagos:        { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  filaPago:          { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', gap: '0.75rem', flexWrap: 'wrap' },
  filaPagoIzq:       { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  filaPagoDer:       { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  pagoMonto:         { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)' },
  pagoMeta:          { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' },
  pagoMetodo:        { fontSize: 'var(--text-xs)', color: 'var(--neutral-200)', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '0.1rem 0.45rem' },
  pagoRecibo:        { fontSize: 'var(--text-xs)', color: 'var(--neutral-300)' },
  editSeguro:        { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', paddingLeft: '0.5rem' },
  btnPrimary:        { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  btnSecondary:      { backgroundColor: 'var(--surface-raised)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },
  btnDisabled:       { backgroundColor: 'var(--surface)', color: 'var(--neutral-400)', fontSize: 'var(--text-body)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.5 },
  btnPDF:            { backgroundColor: 'transparent', color: 'var(--blue-300)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', padding: '0.2rem 0.55rem', border: '1px solid rgba(51,133,214,0.4)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' },
  btnX:              { backgroundColor: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-sm)' },
  btnRecibido:       { backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', padding: '0.3rem 0.7rem', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' },
  btnEntregar:       { backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', padding: '0.4rem 0.875rem', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer' },
  btnConfirmar:      { backgroundColor: '#22c55e', color: '#000', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', padding: '0.45rem 0.875rem', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' },
  btnCancelar:       { backgroundColor: 'transparent', color: 'var(--neutral-400)', fontSize: 'var(--text-small)', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' },
  btnEntrega:        { backgroundColor: '#22c55e', color: '#000', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.7rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  btnEliminar:       { backgroundColor: 'var(--danger)', color: '#fff', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.7rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  err:               { fontSize: 'var(--text-small)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', margin: 0 },
  vacio:             { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', margin: 0, fontStyle: 'italic' },
  overlay:           { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:             { backgroundColor: 'var(--surface)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', maxWidth: '460px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  modalTitulo:       { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0 },
  modalTexto:        { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 },
}







