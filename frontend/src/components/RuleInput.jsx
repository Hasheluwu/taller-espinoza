import { useEffect, useRef, useState } from 'react'
import { RULES, checkField } from '../lib/fieldRules'

// Text input that tidies the value as it is typed (phone, cédula, plate…) and blocks the
// form with a clear message when the format is wrong. The server checks the same rules.
export default function RuleInput({ rule, value, onChange, name, label, required = false, placeholder, style, className, id, maxLength, disabled, autoFocus, onFocus, onBlur }) {
  const spec = RULES[rule]
  const input = useRef(null)
  const [touched, setTouched] = useState(false)
  const message = checkField(rule, value, { label, required })
  useEffect(() => { input.current?.setCustomValidity(message) }, [message])
  return <span className="rule-input">
    <input
      ref={input} id={id} name={name} type="text" autoComplete="off" disabled={disabled} autoFocus={autoFocus}
      inputMode={spec.inputMode} maxLength={maxLength || spec.maxLength} required={required}
      placeholder={placeholder ?? spec.placeholder} style={style} className={className}
      value={value ?? ''} aria-invalid={touched && !!message}
      onChange={e => onChange({ target: { name, value: spec.format(e.target.value) } })}
      onFocus={onFocus}
      onBlur={e => { setTouched(true); onBlur?.(e) }}
    />
    {touched && message && <small className="rule-input-error" role="alert">{message}</small>}
  </span>
}
