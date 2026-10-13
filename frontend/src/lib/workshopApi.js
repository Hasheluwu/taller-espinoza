import { apiFetch } from './api'
export async function workshopApi(path, method = 'GET', body) {
  const res = await apiFetch(path, { method, headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, ...(body ? { 'Content-Type':'application/json' } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'No se pudo completar la operación.')
  return data
}
export const currency = value => Number(value || 0).toLocaleString('es-NI',{ style:'currency', currency:'NIO' })
