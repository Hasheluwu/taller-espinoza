const { number, cents, fail } = require('../services/validation')
// Defense in depth for numeric inputs received from forms or direct API clients.
module.exports = function validateNumbers(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next()
  try {
    const quantities = ['cantidad', 'cantidad_usada', 'stock_minimo']
    const amounts = ['monto', 'precio', 'precio_unitario', 'precio_unidad', 'subtotal', 'monto_acordado', 'costo_adicional', 'monto_cliente', 'monto_seguro', 'monto_cubierto_seguro', 'monto_extra_cliente', 'precio_asignado']
    for (const [key, value] of Object.entries(req.body || {})) {
      if (value == null) continue
      if (key.startsWith('id_')) number(value, key, { positive: true, integer: true })
      if (quantities.includes(key)) number(value, key, { positive: key === 'cantidad_usada' })
      if (amounts.includes(key)) cents(value, key, key === 'monto')
    }
    if (req.body?.items != null) {
      if (!Array.isArray(req.body.items) || !req.body.items.length) fail('Agrega al menos un producto válido.')
      for (const item of req.body.items) {
        if (!item || typeof item !== 'object') fail('Producto inválido.')
        number(item.id_inventario, 'Producto', { positive: true, integer: true })
        number(item.cantidad, 'Cantidad', { positive: true })
        cents(item.precio_unitario, 'Precio')
      }
    }
    next()
  } catch (err) { next(err) }
}

