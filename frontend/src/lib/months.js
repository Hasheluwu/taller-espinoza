import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const ALL = 'todas'

// Month of the local registration date, so an order received late at night stays in its own month.
export function monthKey(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'sin-fecha' : date.toLocaleDateString('en-CA').slice(0, 7)
}
export function monthLabel(key) {
  return key === 'sin-fecha' ? 'Sin fecha' : `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`
}

// The open folder lives in the URL (?mes=2026-11 or ?mes=todas) so "back" returns to the folders.
export function useMonthFolder(items, dateField = 'fecha_ingreso') {
  const [params, setParams] = useSearchParams()
  const raw = params.get('mes')
  const selected = raw === ALL || /^\d{4}-\d{2}$/.test(raw || '') || raw === 'sin-fecha' ? raw : null
  const select = value => setParams(old => {
    const next = new URLSearchParams(old)
    if (value) next.set('mes', value); else next.delete('mes')
    return next
  })
  const visible = useMemo(() => !selected ? [] : selected === ALL ? items : items.filter(item => monthKey(item[dateField]) === selected), [items, selected, dateField])
  return { selected, select, visible }
}

