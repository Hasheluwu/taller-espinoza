// backend/src/handlers/changeOrderState.js
const { lockOrder } = require('../services/validation')

module.exports = function createChangeOrderState(pool) {
  return async function changeOrderState(req, res) {
    const id = Number(req.params.id)
    const { estado } = req.body || {}
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Orden inválida.' })
    }
    if (!['en_proceso', 'listo', 'entregado'].includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido.' })
    }

    let conn
    try {
      conn = await pool.getConnection()
      await conn.beginTransaction()

      const orden = await lockOrder(conn, id)

      if (orden.estado === estado) {
        await conn.commit()
        return res.json(orden)
      }
      if (['entregado', 'cancelado'].includes(orden.estado)) {
        await conn.rollback()
        return res.status(409).json({ message: 'No se puede cambiar el estado de una orden entregada o cancelada.' })
      }
      if (orden.factura_emitida && estado === 'en_proceso') {
        await conn.rollback()
        return res.status(409).json({ message: 'La orden tiene una factura emitida; no se puede reabrir su reparación.' })
      }
      if (estado === 'entregado' && orden.estado !== 'listo') {
        await conn.rollback()
        return res.status(409).json({ message: 'Marca primero el trabajo como listo antes de entregarlo.' })
      }

      await conn.query(
        `UPDATE orden
         SET estado = ?,
             fecha_entrega_real = CASE WHEN ? = 'entregado' THEN GREATEST(CURRENT_DATE, DATE(fecha_ingreso)) ELSE fecha_entrega_real END
         WHERE id_orden = ?`,
        [estado, estado, id]
      )

      if (estado === 'entregado' && req.body?.numero_factura_fisica) {
        const numFac = require('../services/fieldRules').reference(req.body.numero_factura_fisica, {
          label: 'N° de factura física',
          max: 50,
        })
        if (numFac && orden.tipo_pago === 'particular') {
          await conn.query(
            `INSERT INTO factura (numero_factura, fecha_emision, subtotal, iva)
             VALUES (?, CURDATE(), ?, ?)
             ON DUPLICATE KEY UPDATE subtotal = VALUES(subtotal), iva = VALUES(iva)`,
            [numFac, orden.subtotal || 0, orden.iva || 0]
          )
          await conn.query(
            `INSERT IGNORE INTO factura_cliente (numero_factura, id_orden) VALUES (?, ?)`,
            [numFac, id]
          )
        }
      }

      await conn.query(
        `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
         VALUES (?, 'orden', ?, 'cambio_estado', ?)`,
        [req.usuario.id, String(id), `Estado: ${orden.estado} → ${estado}`]
      )

      const invoices = require('../services/insuranceInvoices')
      if (estado === 'entregado' && invoices.insured(orden)) {
        await invoices.issue(conn, id, req.usuario.id)
      }

      const updated = await lockOrder(conn, id)
      await conn.commit()
      return res.json(updated)
    } catch (err) {
      if (conn) await conn.rollback()
      if (err.status) {
        return res
          .status(err.status)
          .json({ message: estado === 'entregado' ? `No se entregó el vehículo: ${err.message}` : err.message })
      }
      console.error('Error al cambiar estado de orden:', err)
      return res.status(500).json({ message: 'No se pudo guardar el estado de la orden. Intenta nuevamente.' })
    } finally {
      if (conn) conn.release()
    }
  }
}