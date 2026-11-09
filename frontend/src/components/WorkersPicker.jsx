import RuleInput from './RuleInput'
import { checkField } from '../lib/fieldRules'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { workshopApi } from '../lib/workshopApi'
import { ROLE_LABELS, emptyWorkerRow } from '../lib/workers'

const NEW_WORKER = { cedula: '', nombre: '', tipo: 'externo', rol: 'pintor', telefono: '', fijo: false }

export default function WorkersPicker({
  personalLista,
  onWorkerCreated,
  rows,
  setRows,
  blocked = [],
  amountHint = 'Deja el monto vacío si ya fue acordado y registrado.',
}) {
  const [creating, setCreating] = useState(false)
  const [nuevo, setNuevo] = useState(NEW_WORKER)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = rows.map(row => String(row.id_personal)).filter(Boolean)
  const taken = new Set(blocked.map(String))
  const fijos = personalLista.filter(p => p.fijo)
  const otros = personalLista.filter(p => !p.fijo)
  const update = (index, key, value) => setRows(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))

  function addWorker(id) {
    if (chosen.includes(String(id)) || taken.has(String(id))) return
    const empty = rows.findIndex(row => !row.id_personal)
    if (empty >= 0) update(empty, 'id_personal', String(id))
    else setRows([...rows, { ...emptyWorkerRow(), id_personal: String(id) }])
  }
  function removeWorker(id) {
    const left = rows.filter(row => String(row.id_personal) !== String(id))
    setRows(left.length ? left : [emptyWorkerRow()])
  }
  async function create() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const worker = await workshopApi('/api/operaciones/personal', 'POST', nuevo)
      onWorkerCreated(worker)
      addWorker(worker.id)
      setNuevo(NEW_WORKER)
      setCreating(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const option = p => (
    <option key={p.id} value={p.id} disabled={chosen.includes(String(p.id)) || taken.has(String(p.id))}>
      {p.nombre} ({ROLE_LABELS[p.rol] || p.rol}){taken.has(String(p.id)) ? ' · ya en el equipo' : ''}
    </option>
  )

  return (
    <div className="workers-picker">
      <p className="workers-hint">{amountHint}</p>
      {fijos.length > 0 && (
        <div className="workers-quick" aria-label="Personal fijo">
          {fijos.map(p => (
            <button
              key={p.id}
              type="button"
              disabled={taken.has(String(p.id))}
              title={taken.has(String(p.id)) ? 'Ya está en el equipo' : undefined}
              className={chosen.includes(String(p.id)) ? 'is-on' : ''}
              onClick={() => (chosen.includes(String(p.id)) ? removeWorker(p.id) : addWorker(p.id))}
              aria-pressed={chosen.includes(String(p.id))}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}
      {rows.map((row, index) => (
        <div className="workers-row" key={row.key}>
          <label>
            <span>Trabajador {rows.length > 1 ? index + 1 : ''}</span>
            <select value={row.id_personal} onChange={e => update(index, 'id_personal', e.target.value)}>
              <option value="">Seleccionar trabajador…</option>
              {fijos.length > 0 && <optgroup label="Fijos">{fijos.map(option)}</optgroup>}
              {otros.length > 0 && <optgroup label="Otros">{otros.map(option)}</optgroup>}
            </select>
          </label>
          <label>
            <span>Monto acordado (C$)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Ej: 800.00"
              value={row.monto_acordado}
              onChange={e => update(index, 'monto_acordado', e.target.value)}
            />
          </label>
          {rows.length > 1 && (
            <button
              type="button"
              className="workers-remove"
              aria-label={`Quitar trabajador ${index + 1}`}
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <div className="workers-actions">
        <button
          type="button"
          className="workers-link"
          onClick={() => setRows([...rows, emptyWorkerRow()])}
          disabled={rows.length >= 20}
        >
          + Agregar otro trabajador
        </button>
        <button type="button" className="workers-link" onClick={() => setCreating(v => !v)}>
          {creating ? '— Cancelar nuevo trabajador' : '+ Registrar trabajador nuevo'}
        </button>
        <Link className="workers-link" to="/personal">
          Gestionar personal ↗
        </Link>
      </div>
      {creating && (
        <div className="workers-new">
          <label>
            <span>Nombre</span>
            <RuleInput
              rule="name"
              label="Nombre"
              value={nuevo.nombre}
              onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })}
              placeholder="Nombre completo"
            />
          </label>
          <label>
            <span>Cédula</span>
            <RuleInput
              rule="cedula"
              label="Cédula"
              value={nuevo.cedula}
              onChange={e => setNuevo({ ...nuevo, cedula: e.target.value })}
              placeholder="001-010190-0001A"
            />
          </label>
          <div className="workers-new-grid">
            <label>
              <span>Rol</span>
              <select value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Tipo</span>
              <select value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })}>
                <option value="externo">Externo</option>
                <option value="interno">Interno</option>
              </select>
            </label>
          </div>
          <label>
            <span>Teléfono · opcional</span>
            <RuleInput
              rule="phone"
              label="Teléfono"
              value={nuevo.telefono}
              onChange={e => setNuevo({ ...nuevo, telefono: e.target.value })}
            />
          </label>
          <label className="workers-check">
            <input
              type="checkbox"
              checked={nuevo.fijo}
              onChange={e => setNuevo({ ...nuevo, fijo: e.target.checked })}
            />{' '}
            Personal fijo (aparece como opción rápida)
          </label>
          {error && (
            <p className="workers-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="workers-save"
            disabled={
              busy ||
              !!checkField('name', nuevo.nombre, { label: 'Nombre', required: true }) ||
              !!checkField('cedula', nuevo.cedula, { label: 'Cédula', required: true }) ||
              !!checkField('phone', nuevo.telefono, { label: 'Teléfono' })
            }
            onClick={create}
          >
            {busy ? 'Guardando…' : 'Guardar trabajador'}
          </button>
        </div>
      )}
    </div>
  )
}