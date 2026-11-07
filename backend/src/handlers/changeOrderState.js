// A transaction keeps the status and its audit entry consistent.
module.exports = function createChangeOrderState(pool) {
  return async function changeOrderState(req, res) {
    const id = Number(req.params.id)
    const { estado } = req.body || {}
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Orden inválida.' })
    if (!['en_proceso', 'listo', 'entregado'].includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido.' })
    }
    let conn
    try {
      conn = await pool.getConnection()
      await conn.beginTransaction()
      const [rows] = await conn.query('SELECT * FROM orden WHERE id = ? FOR UPDATE', [id])
      if (!rows.length) {
        await conn.rollback()
        return res.status(404).json({ message: 'Orden no encontrada.' })
      }
      const orden = rows[0]
      // Retrying a successful request does not duplicate its audit or delivery date.
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
        `UPDATE orden SET estado = ?, fecha_entrega_real = CASE WHEN ? = 'entregado' THEN CURRENT_DATE ELSE fecha_entrega_real END, numero_factura_fisica = COALESCE(?, numero_factura_fisica) WHERE id = ?`,
        [estado, estado, estado === 'entregado' ? (require('../services/fieldRules').reference(req.body.numero_factura_fisica, { label: 'N° de factura física', max: 30 }) || null) : null, id]
      )
      await conn.query(
        `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, 'orden', ?, 'cambio_estado', ?)`,
        [req.usuario.id, id, `Estado: ${orden.estado} → ${estado}`]
      )
      // Delivering an insured car issues its insurer invoice in the same transaction,
      // so the amount owed by the insurer is never missing from the receivables.
      const invoices = require('../services/insuranceInvoices')
      if (estado === 'entregado' && invoices.insured(orden)) await invoices.issue(conn, id, req.usuario.id)
      const [updated] = await conn.query('SELECT * FROM orden WHERE id = ?', [id])
      await conn.commit()
      return res.json(updated[0])
    } catch (err) {
      if (conn) await conn.rollback()
      if (err.status) return res.status(err.status).json({ message: estado === 'entregado' ? `No se entregó el vehículo: ${err.message}` : err.message })
      console.error('Error al cambiar estado de orden:', err)
      return res.status(500).json({ message: 'No se pudo guardar el estado de la orden. Intenta nuevamente.' })
    } finally {
      if (conn) conn.release()
    }
  }
}

