export default function WizardSteps({ currentStep = 1 }) {
  const steps = [
    { number: 1, title: 'Cliente', desc: 'Identificación & Datos' },
    { number: 2, title: 'Vehículo', desc: 'Placa & Especificaciones' },
    { number: 3, title: 'Presupuesto', desc: 'Servicios & Repuestos' },
    { number: 4, title: 'Confirmación', desc: 'Generar Orden Final' }
  ]

  return (
    <div className="card-cyber animate-fade-in-up" style={{ padding: '1.15rem 1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        {steps.map(step => {
          const isDone = step.number < currentStep
          const isActive = step.number === currentStep

          return (
            <div
              key={step.number}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                opacity: isActive ? 1 : isDone ? 0.9 : 0.45,
                transition: 'all 0.25s ease'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: isDone ? '#10b981' : isActive ? '#ff9559' : 'rgba(255,255,255,0.1)',
                color: isDone || isActive ? '#101215' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '0.9rem',
                boxShadow: isActive ? 'var(--glow-cyan)' : isDone ? 'var(--glow-emerald)' : 'none'
              }}>
                {isDone ? '✓' : step.number}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '800', color: isActive ? '#ffac7c' : isDone ? '#34d399' : '#f9fafb', lineHeight: 1.1 }}>
                  {step.number}. {step.title}
                </span>
                <span style={{ fontSize: '0.725rem', color: '#9ca3af' }}>
                  {step.desc}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

