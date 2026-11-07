const { calculate, text } = require('./proformas')
const { fail } = require('./validation')

module.exports = function privateWork(body) {
  if (!body || !Array.isArray(body.detalles) || !body.detalles.length || body.detalles.length > 100) fail('Agrega entre 1 y 100 conceptos.')
  if (!body.detalles.some(d => d?.tipo_linea === 'servicio')) fail('Describe al menos una actividad de mano de obra para el vehículo.')
  if (body.detalles.some(d => !d || typeof d !== 'object')) fail('Revisa los conceptos del trabajo.')
  const totals = calculate(body)
  const observaciones = text(body.observaciones, 'Observaciones', 4000)
  const labels = { servicio: 'Trabajo', repuesto: 'Repuesto', material: 'Material' }
  const activities = totals.detalles.map(d => ({
    descripcion: text(`${labels[d.tipo_linea]} · ${d.cantidad} × ${d.descripcion}`, 'Descripción del concepto', 255, true),
    precio: d.base, aplica_iva: d.aplica_iva,
  }))
  if (totals.mano_obra_global !== null) activities.push({ descripcion: 'Mano de obra · Monto global', precio: totals.mano_obra_global, aplica_iva: true })
  return { ...totals, activities, observaciones }
}
