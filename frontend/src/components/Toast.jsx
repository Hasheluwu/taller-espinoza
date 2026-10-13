// frontend/src/components/Toast.jsx
import { useState, useCallback, useMemo } from 'react'
import { ToastContext } from '../hooks/useToast'

let _id = 0

const STYLES = {
  success: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', color: '#34d399', glow: 'rgba(16,185,129,0.25)', icon: '✓' },
  error:   { bg: 'rgba(244,63,94,0.15)',  border: '#f43f5e', color: '#fb7185', glow: 'rgba(244,63,94,0.25)',  icon: '✕' },
  warning: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', color: '#fb923c', glow: 'rgba(249,115,22,0.25)', icon: '⚠' },
  info:    { bg: 'rgba(255,149,89,0.15)',  border: '#ff9559', color: '#ffac7c', glow: 'rgba(255,149,89,0.25)',  icon: 'ℹ' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const toast = useMemo(() => ({
    success: msg => add(msg, 'success'),
    error:   msg => add(msg, 'error'),
    warning: msg => add(msg, 'warning'),
    info:    msg => add(msg, 'info'),
  }), [add])

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Container de toasts — esquina inferior derecha */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '0.5rem',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const s = STYLES[t.type] || STYLES.info
          return (
            <div
              key={t.id}
              className="animate-fade-in-up"
              style={{
                background: `linear-gradient(135deg, ${s.bg}, rgba(17,24,39,0.95))`,
                border: `1px solid ${s.border}`,
                borderLeft: `4px solid ${s.border}`,
                color: s.color,
                padding: '0.8rem 1.1rem',
                borderRadius: '0.6rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                minWidth: '280px',
                maxWidth: '420px',
                backdropFilter: 'blur(16px)',
                boxShadow: `0 8px 30px rgba(0,0,0,0.6), 0 0 20px ${s.glow}`,
                fontFamily: "'SKModernist', sans-serif",
                fontSize: '0.875rem',
                fontWeight: '600',
                pointerEvents: 'auto',
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontSize: '1.1rem', flexShrink: 0, fontWeight: '900' }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

