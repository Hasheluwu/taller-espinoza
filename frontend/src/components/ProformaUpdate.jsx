import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { workshopApi as api, currency } from '../lib/workshopApi'

// Shown in an order made from a proforma when charges were added afterwards: lists them and
// creates a new version of the same proforma that includes them.
export default function ProformaUpdate({ idPresupuesto, refresh }) {
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  useEffect(() => {
    let active = true
    api(`/api/proformas/${idPresupuesto}/cargos-pendientes`)
      .then(data => { if (active) setPending(data) })
      .catch(() => { if (active) setPending(null) })
    return () => { active = false }
  }, [idPresupuesto, refresh])

  async function update() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const p = await api(`/api/proformas/${idPresupuesto}/actualizar-desde-orden`, 'POST')
      setDone(p); setPending({ cantidad: 0, cargos: [] })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (done) return <div className="proforma-update is-done" role="status">
    <p>Proforma N° {done.numero || done.id} actualizada a la versión {done.version}. Nuevo total: <b>{currency(done.total)}</b>. La versión anterior sigue en el historial.</p>
    <Link to={`/proformas/${idPresupuesto}`}>Ver proforma →</Link>
  </div>
  if (!pending?.cantidad) return null
  return <div className="proforma-update">
    <div>
      <strong>{pending.cantidad === 1 ? 'Hay 1 cargo nuevo que no está en la proforma' : `Hay ${pending.cantidad} cargos nuevos que no están en la proforma`}</strong>
      <ul>{pending.cargos.map(c => <li key={c.id}>{c.descripcion} · {currency(c.precio)}{c.aplica_iva ? ' + IVA' : ''}</li>)}</ul>
      <small>Al actualizarla se crea una nueva versión con el mismo número; la versión aprobada se conserva en el historial. Si la aseguradora debe aprobar el cambio, imprímela y preséntala de nuevo.</small>
      {error && <p className="proforma-update-error" role="alert">{error}</p>}
    </div>
    <button type="button" className="btn-cyber-orange" disabled={busy} onClick={update}>{busy ? 'Actualizando…' : 'Actualizar proforma'}</button>
  </div>
}
