// Manual UI regression fixture: no real API or workshop records are used.
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Pagos from '../src/pages/Pagos'
import '../src/index.css'
const order = { id: 1, estado: 'en_proceso', tipo: 'mecanica', tipo_pago: 'particular', costo_total: 50000, nombre_cliente: 'Cliente de prueba', matricula: 'PRUEBA-01' }
const payments = [{ id: 1, monto: 5000, tipo: 'adelanto', metodo: 'efectivo' }, { id: 2, monto: 3000, tipo: 'abono', metodo: 'efectivo' }]
function balance() {
  const paid = payments.reduce((sum, p) => sum + Number(p.monto), 0)
  return { pagos_cliente: payments, pagos_seguro: [], total_cliente: paid, gran_total: paid, total_orden: 50000, saldo_cliente: 50000 - paid, saldo_total: 50000 - paid, configurado: true, pagado: paid === 50000, cliente_pagado: paid === 50000, puede_cobrar_cliente: paid < 50000 }
}
window.fetch = async (url, options = {}) => {
  const path = new URL(url, location.origin).pathname
  let data, status = 200
  if (path === '/api/ordenes/1') data = order
  else if (path === '/api/pagos/1/resumen') data = balance()
  else if (path === '/api/pagos/1/cliente' && options.method === 'POST') {
    const payload = JSON.parse(options.body)
    if (Number(payload.monto) > balance().saldo_cliente) { data = { message: 'El pago supera el saldo disponible.' }; status = 409 }
    else { const record = { ...payload, id: payments.length + 1 }; payments.push(record); data = { ...record, resumen: balance() } }
  } else throw new Error('Esta prueba no usa servicios reales.')
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
window.open = () => null
createRoot(document.getElementById('root')).render(<><p style={{ background: '#513520', padding: 12 }}>PRUEBA AISLADA · datos simulados · no modifica la base de datos</p><MemoryRouter initialEntries={['/ordenes/1/pago']}><Routes><Route path="/ordenes/:id/pago" element={<Pagos/>}/></Routes></MemoryRouter></>)

