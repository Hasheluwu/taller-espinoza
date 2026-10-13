import { useState } from 'react'
import { apiFetch } from '../lib/api'

const fmt = n => Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function PaymentBalance({ resumen, esSeguro }) {
  if (!resumen) return null
  return <section className="card-cyber" style={{ padding: '1.5rem' }} aria-label="Saldo de la orden">
    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <h2>{resumen.pagado ? '✓ Pagado' : 'Saldo de la orden'}</h2>
      <strong role="status" style={{ color: resumen.pagado ? '#83dfc0' : '#ffac7c' }}>{resumen.configurado ? `Pendiente: C$ ${fmt(resumen.saldo_total)}` : 'Total o distribución por definir'}</strong>
    </div>
    <p>Total: C$ {fmt(resumen.total_orden)} · Recibido: C$ {fmt(resumen.gran_total)}</p>
    {resumen.configurado && <progress aria-label="Progreso del pago" max={resumen.total_orden} value={resumen.aplicado_a_deuda ?? Math.min(resumen.gran_total, resumen.total_orden)} style={{ width: '100%', accentColor: '#83dfc0', margin: '16px 0' }}/>}
    <p>Cliente: C$ {fmt(resumen.total_cliente)} abonados · {resumen.cliente_pagado ? 'Pagado' : `Pendiente C$ ${fmt(resumen.saldo_cliente)}`}</p>
    {esSeguro && <p>Seguro: C$ {fmt(resumen.seguro_recibido)} recibidos · {resumen.seguro_pagado ? 'Pagado' : `Pendiente C$ ${fmt(resumen.saldo_seguro)}`} · Cobros por recibir C$ {fmt(resumen.seguro_pendiente)}</p>}
    {resumen.pagado && <p>El total está cubierto. Puedes consultar e imprimir los recibos del historial.</p>}
    {resumen.excedente > 0 && <p role="alert">Excedente por conciliar: C$ {fmt(resumen.excedente)}. Cliente: C$ {fmt(resumen.excedente_cliente)} · Seguro: C$ {fmt(resumen.excedente_seguro)}. No forma parte de la venta ni de la ganancia. Su devolución o aplicación a otra orden requiere conciliación; este sistema no la realiza automáticamente.</p>}
    {!resumen.configurado && <p>Define el total en las operaciones de la orden{esSeguro ? ' y distribúyelo entre cliente y seguro' : ''} antes de registrar pagos.</p>}
  </section>
}
export function PaymentAllocation({ idOrden, resumen, onSaved }) {
  const [cliente, setCliente] = useState(resumen.monto_cliente ?? '')
  const [seguro, setSeguro] = useState(resumen.monto_seguro ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await apiFetch(`/api/pagos/${idOrden}/distribucion`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ monto_cliente: cliente, monto_seguro: seguro }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      onSaved(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <form onSubmit={save} className="card-cyber" style={{ padding: '1.5rem', display: 'grid', gap: 12 }}>
    <h3>Distribución del pago</h3><p>Las dos partes deben sumar C$ {fmt(resumen.total_orden)}.</p>
    <label>Parte del cliente (C$)<input type="number" min="0" step="0.01" required value={cliente} onChange={e => setCliente(e.target.value)}/></label>
    <label>Parte de la aseguradora (C$)<input type="number" min="0" step="0.01" required value={seguro} onChange={e => setSeguro(e.target.value)}/></label>
    {error && <p role="alert">{error}</p>}<button className="btn-cyber-orange" disabled={busy || !resumen.total_orden}>{busy ? 'Guardando…' : 'Guardar distribución'}</button>
  </form>
}
