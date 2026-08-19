import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('Conectando...')

  useEffect(() => {
    fetch('http://localhost:3001/api/ping')
      .then(r => r.json())
      .then(d => setStatus(d.message))
      .catch(() => setStatus('Error — backend no responde'))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-xl shadow p-10 text-center">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
          Taller Pedro Espinoza
        </h1>
        <p className="text-gray-500">{status}</p>
      </div>
    </div>
  )
}