// frontend/src/components/Skeleton.jsx

const shimmerStyle = {
  background: 'linear-gradient(90deg, #22262c 25%, #2d3748 50%, #22262c 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.6s infinite',
  borderRadius: '0.375rem',
}

function Bar({ width = '100%', height = '1rem', style = {} }) {
  return <div style={{ ...shimmerStyle, width, height, ...style }} />
}

/** Skeleton para tarjeta de Inventario */
export function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.5rem',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      <Bar width="65%" height="1.1rem" />
      <Bar width="40%" height="0.8rem" />
      <div style={{ backgroundColor: 'var(--background)', borderRadius: '0.375rem', padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <Bar width="50%" height="0.7rem" />
          <Bar width="70%" height="1.4rem" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <Bar width="50%" height="0.7rem" />
          <Bar width="70%" height="1.4rem" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Bar width="100%" height="2rem" style={{ flex: 1 }} />
        <Bar width="100%" height="2rem" style={{ flex: 1 }} />
      </div>
    </div>
  )
}

/** Skeleton para fila de lista (Repuestos) */
export function SkeletonRow() {
  return (
    <div style={{
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: '0.375rem',
      padding: '0.75rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '1rem',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <Bar width="55%" height="1rem" />
        <Bar width="75%" height="0.75rem" />
        <Bar width="50%" height="0.75rem" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
        <Bar width="60px" height="1rem" />
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <Bar width="30px" height="1.8rem" />
          <Bar width="30px" height="1.8rem" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton genérico de texto */
export function SkeletonText({ width = '100%', height = '1rem' }) {
  return <Bar width={width} height={height} />
}

/** Grid de N skeleton cards */
export function SkeletonGrid({ count = 6 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

/** Lista de N skeleton rows */
export function SkeletonList({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}

