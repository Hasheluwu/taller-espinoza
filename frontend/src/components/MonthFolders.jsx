import { useMemo } from 'react'
import { ALL, monthKey, monthLabel } from '../lib/months'

function FolderIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/></svg>
}

const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`

// Folder grid by month of registration, plus a shortcut to the full list.
export function MonthFolderGrid({ items, dateField = 'fecha_ingreso', onSelect, noun = ['orden', 'órdenes'], allLabel = 'Mostrar todas las órdenes', isActive = item => !['entregado', 'cancelado'].includes(item.estado) }) {
  const current = new Date().toLocaleDateString('en-CA').slice(0, 7)
  const folders = useMemo(() => {
    const groups = new Map([[current, []]])
    for (const item of items) {
      const key = monthKey(item[dateField])
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [items, dateField, current])
  return <section className="month-folders" aria-label="Carpetas por mes">
    <div className="month-folders-head">
      <div><span className="section-kicker">CARPETAS POR MES</span><p>Elige un mes para ver solo lo registrado en ese mes.</p></div>
      <button type="button" className="btn-cyber-outline" onClick={() => onSelect(ALL)}>{allLabel} · {items.length}</button>
    </div>
    <div className="month-folder-grid">
      {folders.map(([key, list]) => {
        const active = list.filter(isActive).length
        return <button type="button" key={key} className={`month-folder ${key === current ? 'is-current' : ''}`} onClick={() => onSelect(key)} disabled={!list.length && key !== current}>
          <span className="month-folder-icon"><FolderIcon/></span>
          <span className="month-folder-name">{monthLabel(key)}{key === current && <em>Mes actual</em>}</span>
          <strong>{plural(list.length, noun)}</strong>
          <small>{list.length ? `${active} en curso · ${list.length - active} cerradas` : 'Sin registros este mes'}</small>
        </button>
      })}
    </div>
  </section>
}

// Header shown above the list once a folder (or "all") is open.
export function MonthFolderBar({ selected, count, onSelect, noun = ['orden', 'órdenes'], allLabel = 'Mostrar todas las órdenes' }) {
  return <div className="month-folder-bar">
    <button type="button" className="text-action" onClick={() => onSelect(null)}>← Carpetas por mes</button>
    <strong>{selected === ALL ? 'Todos los meses' : monthLabel(selected)}<span>{plural(count, noun)}</span></strong>
    {selected !== ALL && <button type="button" className="btn-cyber-outline" onClick={() => onSelect(ALL)}>{allLabel}</button>}
  </div>
}
