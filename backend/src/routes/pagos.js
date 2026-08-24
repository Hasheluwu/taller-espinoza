// backend/src/routes/pagos.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

// ═══════════════════════════════════════════════════════════
// RESUMEN DE PAGOS DE UNA ORDEN
// GET /api/pagos/:id_orden/resumen
// ═══════════════════════════════════════════════════════════
router.get('/:id_orden/resumen', requireAuth, async (req, res) => {
  try {
    const { id_orden } = req.params

    const [pagosCliente] = await pool.query(
      'SELECT * FROM pago_cliente WHERE id_orden = ? ORDER BY fecha ASC',
      [id_orden]
    )
    const [pagosSeguro] = await pool.query(
      'SELECT * FROM pago_seguro WHERE id_orden = ? ORDER BY id ASC',
      [id_orden]
    )

    const totalCliente    = pagosCliente.reduce((s, p) => s + parseFloat(p.monto), 0)
    const totalSeguro     = pagosSeguro.reduce((s, p) => s + parseFloat(p.monto), 0)
    const seguroRecibido  = pagosSeguro
      .filter(p => p.estado === 'recibido')
      .reduce((s, p) => s + parseFloat(p.monto), 0)
    const seguroPendiente = pagosSeguro
      .filter(p => p.estado === 'pendiente')
      .reduce((s, p) => s + parseFloat(p.monto), 0)

    res.json({
      pagos_cliente:    pagosCliente,
      pagos_seguro:     pagosSeguro,
      total_cliente:    totalCliente,
      total_seguro:     totalSeguro,
      seguro_recibido:  seguroRecibido,
      seguro_pendiente: seguroPendiente,
      gran_total:       totalCliente + seguroRecibido,
    })
  } catch (err) {
    console.error('Error al obtener resumen de pagos:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ═══════════════════════════════════════════════════════════
// PAGOS DEL CLIENTE
// POST /api/pagos/:id_orden/cliente
// ═══════════════════════════════════════════════════════════
router.post('/:id_orden/cliente', requireAuth, async (req, res) => {
  const { id_orden } = req.params
  const { monto, fecha, tipo, metodo, numero_recibo } = req.body

  if (!monto || !tipo || !metodo) {
    return res.status(400).json({ message: 'Faltan campos obligatorios: monto, tipo, método.' })
  }

  const tiposValidos  = ['adelanto', 'abono', 'saldo']
  const metodosValidos = ['efectivo', 'transferencia', 'otro']
  if (!tiposValidos.includes(tipo))     return res.status(400).json({ message: 'Tipo de pago inválido.' })
  if (!metodosValidos.includes(metodo)) return res.status(400).json({ message: 'Método de pago inválido.' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.query(
      `INSERT INTO pago_cliente (id_orden, monto, fecha, tipo, metodo, numero_recibo, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id_orden,
        parseFloat(monto),
        fecha || new Date(),
        tipo,
        metodo,
        numero_recibo?.trim() || null,
        req.usuario.id,
      ]
    )

    await conn.query(
      `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
       VALUES (?, 'pago_cliente', ?, 'crear', ?)`,
      [req.usuario.id, result.insertId, `Pago ${tipo} de C$ ${monto} por ${metodo}`]
    )

    await conn.commit()

    const [nuevo] = await conn.query(
      'SELECT * FROM pago_cliente WHERE id = ?',
      [result.insertId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error('Error al registrar pago de cliente:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

// DELETE /api/pagos/cliente/:id
router.delete('/cliente/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pago_cliente WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Pago no encontrado.' })

    await pool.query('DELETE FROM pago_cliente WHERE id = ?', [req.params.id])
    res.json({ message: 'Pago eliminado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ═══════════════════════════════════════════════════════════
// PAGOS DE ASEGURADORA
// POST /api/pagos/:id_orden/seguro
// ═══════════════════════════════════════════════════════════
router.post('/:id_orden/seguro', requireAuth, async (req, res) => {
  const { id_orden } = req.params
  const { monto, fecha_esperada, fecha_recibido, estado, referencia_bancaria, concepto } = req.body

  if (!monto || !concepto) {
    return res.status(400).json({ message: 'Faltan campos obligatorios: monto, concepto.' })
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO pago_seguro (id_orden, monto, fecha_esperada, fecha_recibido, estado, referencia_bancaria, concepto)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id_orden,
        parseFloat(monto),
        fecha_esperada    || null,
        fecha_recibido    || null,
        estado            || 'pendiente',
        referencia_bancaria?.trim() || null,
        concepto,
      ]
    )
    const [nuevo] = await pool.query('SELECT * FROM pago_seguro WHERE id = ?', [result.insertId])
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error('Error al registrar pago de seguro:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// PATCH /api/pagos/seguro/:id/estado — marcar como recibido
router.patch('/seguro/:id/estado', requireAuth, async (req, res) => {
  const { estado, fecha_recibido, referencia_bancaria } = req.body
  if (!['pendiente', 'recibido'].includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido.' })
  }
  try {
    await pool.query(
      'UPDATE pago_seguro SET estado = ?, fecha_recibido = ?, referencia_bancaria = ? WHERE id = ?',
      [estado, fecha_recibido || null, referencia_bancaria || null, req.params.id]
    )
    const [updated] = await pool.query('SELECT * FROM pago_seguro WHERE id = ?', [req.params.id])
    if (updated.length === 0) return res.status(404).json({ message: 'Pago no encontrado.' })
    res.json(updated[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// DELETE /api/pagos/seguro/:id
router.delete('/seguro/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM pago_seguro WHERE id = ?', [req.params.id])
    res.json({ message: 'Pago de seguro eliminado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ═══════════════════════════════════════════════════════════
// CAMBIAR ESTADO A ENTREGADO
// PATCH /api/pagos/:id_orden/entregar
// ═══════════════════════════════════════════════════════════
router.patch('/:id_orden/entregar', requireAuth, async (req, res) => {
  const { numero_factura_fisica } = req.body
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(
      `UPDATE orden SET estado = 'entregado', fecha_entrega_real = CURRENT_DATE,
       numero_factura_fisica = ? WHERE id = ?`,
      [numero_factura_fisica?.trim() || null, req.params.id_orden]
    )

    await conn.query(
      `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
       VALUES (?, 'orden', ?, 'cambio_estado', 'Orden marcada como entregada desde pagos')`,
      [req.usuario.id, req.params.id_orden]
    )

    await conn.commit()
    const [updated] = await conn.query('SELECT * FROM orden WHERE id = ?', [req.params.id_orden])
    res.json(updated[0])
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

module.exports = router
