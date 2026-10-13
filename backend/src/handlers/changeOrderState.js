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
      await conn.query(
        `UPDATE orden SET estado = ?, fecha_entrega_real = CASE WHEN ? = 'entregado' THEN CURRENT_DATE ELSE fecha_entrega_real END, numero_factura_fisica = COALESCE(?, numero_factura_fisica) WHERE id = ?`,
        [estado, estado, estado === 'entregado' ? (req.body.numero_factura_fisica?.trim() || null) : null, id]
      )
      await conn.query(
        `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, 'orden', ?, 'cambio_estado', ?)`,
        [req.usuario.id, id, `Estado: ${orden.estado} → ${estado}`]
      )
      const [updated] = await conn.query('SELECT * FROM orden WHERE id = ?', [id])
      await conn.commit()
      return res.json(updated[0])
    } catch (err) {
      if (conn) await conn.rollback()
      console.error('Error al cambiar estado de orden:', err)
      return res.status(500).json({ message: 'No se pudo guardar el estado de la orden. Intenta nuevamente.' })
    } finally {
      if (conn) conn.release()
    }
  }
}

