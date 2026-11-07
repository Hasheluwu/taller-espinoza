const { cents, fail } = require('./validation')

module.exports = function initialActivities(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) fail('Agrega entre 1 y 100 actividades para el vehículo.')
  let subtotal = 0, iva = 0
  const activities = items.map((item, index) => {
    const descripcion = typeof item?.descripcion === 'string' ? item.descripcion.trim() : ''
    if (!descripcion || descripcion.length > 255) fail(`Actividad ${index + 1}: escribe una descripción de hasta 255 caracteres.`)
    const precio = cents(item.precio, `Precio de actividad ${index + 1}`)
    if (typeof item.aplica_iva !== 'boolean') fail(`Actividad ${index + 1}: indica si aplica IVA.`)
    subtotal += precio
    iva += item.aplica_iva ? Math.round(precio * 15 / 100) : 0
    if (subtotal + iva > 9999999999) fail('El total supera el importe permitido.')
    return { descripcion, precio: precio / 100, aplica_iva: item.aplica_iva }
  })
  return { activities, subtotal: subtotal / 100, iva: iva / 100, total: (subtotal + iva) / 100 }
}
