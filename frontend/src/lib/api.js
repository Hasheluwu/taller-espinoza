const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')

export const API_URL = API_BASE
// All modules use the same API origin, including inventory's relative URLs.
export async function apiFetch(path, options) {
  let response
  try {
    response = await fetch(path.startsWith('/api/') ? `${API_BASE}${path}` : path, options)
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba que el backend esté disponible.')
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('El servidor no devolvió datos válidos. Revisa la dirección de la API y reinicia el backend.')
  }
  if (response.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/login')) {
    localStorage.removeItem('token')
    window.location.assign('/login')
  }
  return response
}


