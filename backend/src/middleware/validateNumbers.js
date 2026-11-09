// backend/src/middleware/validateNumbers.js
const { number, cents, fail } = require('../services/validation')

// Defense in depth for numeric inputs received from forms or direct API clients.
const OPTIONAL = [
  'monto_cubierto_seguro',
  'monto_extra_cliente',
  'monto_acordado',
  'id_personal',
  'id_presupuesto',
  'id_orden_origen',
]
const LABELS = {
  cantidad: 'Cantidad',
  cantidad_usada: 'Cantidad usada',
  stock_minimo: 'Stock mínimo',
  monto: 'Monto',
  precio: 'Precio',
  precio_unitario: 'Precio unitario',
  precio_unidad: 'Precio por unidad',
  subtotal: 'Subtotal',
  monto_acordado: 'Monto acordado',
  costo_adicional: 'Costo adicional',
  monto_cliente: 'Parte del cliente',
  monto_seguro: 'Parte del seguro',
  monto_cubierto_seguro: 'Monto cubierto por seguro',
  monto_extra_cliente: 'Monto extra al cliente',
  precio_asignado: 'Precio asignado',
  id_personal: 'Trabajador',
  id_material: 'Material',
  id_repuesto: 'Repuesto',
  id_vehiculo: 'Vehículo',
  id_cliente: 'Cliente',
  id_orden: 'Orden',
  id_inventario: 'Producto',
}

module.exports = function validateNumbers(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next()
  try {
    const quantities = ['cantidad', 'cantidad_usada', 'stock_minimo']
    const amounts = [
      'monto',
      'precio',
      'precio_unitario',
      'precio_unidad',
      'subtotal',
      'monto_acordado',
      'costo_adicional',
      'monto_cliente',
      'monto_seguro',
      'monto_cubierto_seguro',
      'monto_extra_cliente',
      'precio_asignado',
    ]
    for (const [key, value] of Object.entries(req.body || {})) {
      if (value == null || (value === '' && OPTIONAL.includes(key))) continue
      const name = LABELS[key] || key
      // En el modelo 3FN, vehiculo se identifica por su matrícula (VARCHAR), no por un entero
      if (key === 'id_vehiculo') {
        if (typeof value !== 'string' && typeof value !== 'number') fail('Vehículo inválido.')
        if (!String(value).trim()) fail('Vehículo es requerido.')
        continue
      }
      if (key.startsWith('id_')) number(value, name, { positive: true, integer: true })
      if (quantities.includes(key)) number(value, name, { positive: key === 'cantidad_usada' })
      if (amounts.includes(key)) cents(value, name, key === 'monto')
    }
    if (req.body?.items != null) {
      if (!Array.isArray(req.body.items) || !req.body.items.length) fail('Agrega al menos un producto válido.')
      for (const item of req.body.items) {
        if (!item || typeof item !== 'object') fail('Producto inválido.')
        number(item.id_inventario || item.id_material, 'Producto', { positive: true, integer: true })
        number(item.cantidad, 'Cantidad', { positive: true })
        cents(item.precio_unitario, 'Precio')
      }
    }
    next()
  } catch (err) {
    next(err)
  }
}