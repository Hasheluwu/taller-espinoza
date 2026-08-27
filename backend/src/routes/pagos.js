// backend/src/routes/pagos.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

// Estados en los que aún se puede modificar una orden
const ESTADOS_EDITABLES = ['recibido', 'en_proceso']

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

  const tiposValidos   = ['adelanto', 'abono', 'saldo']
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

// ───────────────────────────────────────────────────────────
// DELETE /api/pagos/cliente/:id
// Verifica existencia y que la orden aún sea editable.
// ───────────────────────────────────────────────────────────
router.delete('/cliente/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Verificar que el pago existe
    const [rows] = await conn.query(
      'SELECT pc.*, o.estado AS estado_orden FROM pago_cliente pc JOIN orden o ON o.id = pc.id_orden WHERE pc.id = ?',
      [req.params.id]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Pago no encontrado.' })
    }

    // 2. Verificar que la orden todavía permite modificaciones
    const pago = rows[0]
    if (!ESTADOS_EDITABLES.includes(pago.estado_orden)) {
      await conn.rollback()
      return res.status(400).json({
        message: `No se puede eliminar el pago porque la orden está en estado "${pago.estado_orden}".`,
      })
    }

    // 3. Eliminar
    await conn.query('DELETE FROM pago_cliente WHERE id = ?', [req.params.id])

    await conn.query(
      `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
       VALUES (?, 'pago_cliente', ?, 'eliminar', ?)`,
      [req.usuario.id, req.params.id, `Pago eliminado de orden #${pago.id_orden} — monto C$ ${pago.monto}`]
    )

    await conn.commit()
    res.json({ message: 'Pago eliminado.' })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
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

  const conceptosValidos = ['pago_principal', 'dano_oculto', 'otro']
  const estadosValidos   = ['pendiente', 'recibido']
  if (!conceptosValidos.includes(concepto))             return res.status(400).json({ message: 'Concepto inválido.' })
  if (estado && !estadosValidos.includes(estado))       return res.status(400).json({ message: 'Estado inválido.' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.query(
      `INSERT INTO pago_seguro (id_orden, monto, fecha_esperada, fecha_recibido, estado, referencia_bancaria, concepto)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id_orden,
        parseFloat(monto),
        fecha_esperada         || null,
        fecha_recibido         || null,
        estado                 || 'pendiente',
        referencia_bancaria?.trim() || null,
        concepto,
      ]
    )

    await conn.query(
      `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
       VALUES (?, 'pago_seguro', ?, 'crear', ?)`,
      [
        req.usuario.id,
        result.insertId,
        `Cobro al seguro registrado — C$ ${monto} — concepto: ${concepto} — estado: ${estado || 'pendiente'}`,
      ]
    )

    await conn.commit()

    const [nuevo] = await conn.query('SELECT * FROM pago_seguro WHERE id = ?', [result.insertId])
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error('Error al registrar pago de seguro:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

// ───────────────────────────────────────────────────────────
// PATCH /api/pagos/seguro/:id/estado — marcar como recibido
// ───────────────────────────────────────────────────────────
router.patch('/seguro/:id/estado', requireAuth, async (req, res) => {
  const { estado, fecha_recibido, referencia_bancaria } = req.body

  if (!['pendiente', 'recibido'].includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Verificar existencia primero
    const [rows] = await conn.query('SELECT * FROM pago_seguro WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Pago de seguro no encontrado.' })
    }

    // 2. Actualizar
    await conn.query(
      'UPDATE pago_seguro SET estado = ?, fecha_recibido = ?, referencia_bancaria = ? WHERE id = ?',
      [estado, fecha_recibido || null, referencia_bancaria || null, req.params.id]
    )

    await conn.query(
      `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
       VALUES (?, 'pago_seguro', ?, 'cambio_estado', ?)`,
      [
        req.usuario.id,
        req.params.id,
        `Estado actualizado a "${estado}"${referencia_bancaria ? ` — ref: ${referencia_bancaria}` : ''}`,
      ]
    )

    await conn.commit()

    const [updated] = await conn.query('SELECT * FROM pago_seguro WHERE id = ?', [req.params.id])
    res.json(updated[0])
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

// ───────────────────────────────────────────────────────────
// DELETE /api/pagos/seguro/:id
// ───────────────────────────────────────────────────────────
router.delete('/seguro/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Verificar existencia
    const [rows] = await conn.query('SELECT * FROM pago_seguro WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Pago de seguro no encontrado.' })
    }

    const pago = rows[0]

    // 2. Eliminar
    await conn.query('DELETE FROM pago_seguro WHERE id = ?', [req.params.id])

    await conn.query(
      `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
       VALUES (?, 'pago_seguro', ?, 'eliminar', ?)`,
      [
        req.usuario.id,
        req.params.id,
        `Cobro al seguro eliminado — C$ ${pago.monto} — concepto: ${pago.concepto}`,
      ]
    )

    await conn.commit()
    res.json({ message: 'Pago de seguro eliminado.' })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

// ═══════════════════════════════════════════════════════════
// CAMBIAR ESTADO A ENTREGADO
// PATCH /api/pagos/:id_orden/entregar
// FIX: ahora verifica que la orden no esté ya entregada o cancelada
// antes de hacer el UPDATE, evitando registros duplicados en auditoría.
// ═══════════════════════════════════════════════════════════
router.patch('/:id_orden/entregar', requireAuth, async (req, res) => {
  const { numero_factura_fisica } = req.body
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Verificar estado actual de la orden
    const [rows] = await conn.query(
      'SELECT estado FROM orden WHERE id = ?',
      [req.params.id_orden]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Orden no encontrada.' })
    }
    if (rows[0].estado === 'entregado') {
      await conn.rollback()
      return res.status(400).json({ message: 'La orden ya está marcada como entregada.' })
    }
    if (rows[0].estado === 'cancelado') {
      await conn.rollback()
      return res.status(400).json({ message: 'No se puede entregar una orden cancelada.' })
    }

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