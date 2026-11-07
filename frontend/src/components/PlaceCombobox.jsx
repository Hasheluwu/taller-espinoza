import { useEffect, useId, useRef, useState } from 'react'
import { findDepartamento, searchDepartamentos } from '../lib/nicaragua'

// Departamento field: type to filter and pick from the list. Only names from the list are accepted.
// It is stored in the client's existing residence column (municipio_residencia).
export default function PlaceCombobox({ value, onChange, name = 'municipio_residencia', required = false, placeholder = 'Escribe o elige un departamento…', style, className, id }) {
  const autoId = useId()
  const inputId = id || `${autoId}-input`
  const listId = `${autoId}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const list = useRef(null)
  const options = searchDepartamentos(value)
  const match = findDepartamento(value)
  const emit = text => onChange({ target: { name, value: text } })

  useEffect(() => {
    input.current?.setCustomValidity(value && !match ? 'Elige un departamento de la lista.' : '')
  }, [value, match])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(option) {
    emit(option)
    setOpen(false)
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); choose(options[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return <div className="place-combobox">
    <input
      ref={input} id={inputId} name={name} type="text" autoComplete="off" maxLength={100}
      role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
      value={value || ''} required={required} placeholder={placeholder} style={style} className={className}
      onChange={e => { emit(e.target.value); setOpen(true); setActive(0) }}
      onFocus={() => setOpen(true)}
      onClick={() => setOpen(true)}
      onKeyDown={onKeyDown}
      onBlur={() => { setOpen(false); if (match && match !== value) emit(match) }}
    />
    {value && !match && !open && <small className="place-combobox-error" role="alert">Elige un departamento de la lista.</small>}
    {open && <ul ref={list} id={listId} role="listbox" className="place-combobox-list" onMouseDown={e => e.preventDefault()}>
      {options.length ? options.map((option, index) => <li
        key={option} id={`${listId}-${index}`} data-index={index}
        role="option" aria-selected={index === active}
        className={index === active ? 'is-active' : ''}
        onMouseEnter={() => setActive(index)} onClick={() => choose(option)}
      ><strong>{option}</strong></li>)
        : <li className="place-combobox-empty" role="option" aria-selected="false" aria-disabled="true">Sin coincidencias. Revisa cómo se escribe.</li>}
    </ul>}
  </div>
}
