// backend/test/verificar-v7.test.cjs
const test = require('node:test')
const assert = require('node:assert/strict')
const pool = require('../src/db')

test('1. Estructura 3FN/BCNF: Existen exactamente 53 tablas base y 7 vistas, con 0 columnas JSON', async () => {
  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
  )
  const [views] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.VIEWS
     WHERE TABLE_SCHEMA = DATABASE()`
  )
  const [jsonCols] = await pool.query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE = 'json'`
  )

  assert.equal(tables.length, 53, `Se esperaban 53 tablas base, se encontraron ${tables.length}`)
  assert.equal(views.length, 7, `Se esperaban 7 vistas, se encontraron ${views.length}`)
  assert.equal(jsonCols.length, 0, 'No debe existir ninguna columna tipo JSON en el modelo relacional')
})

test('2. Vistas Calculadas (3FN): Stock, Órdenes, Presupuestos, Facturas y Liquidaciones calculan sin error', async () => {
  const [stockMat] = await pool.query('SELECT * FROM vw_stock_material')
  assert.ok(stockMat.length >= 5, 'vw_stock_material debe devolver materiales con su stock calculado')

  const [stockRep] = await pool.query('SELECT * FROM vw_stock_repuesto_taller')
  assert.ok(stockRep.length >= 4, 'vw_stock_repuesto_taller debe devolver repuestos con stock_disponible')

  const [presupuestos] = await pool.query('SELECT * FROM vw_totales_presupuesto')
  assert.ok(presupuestos.length >= 5, 'vw_totales_presupuesto debe calcular subtotal, iva y total')

  const [ordenes] = await pool.query('SELECT * FROM vw_totales_orden')
  assert.ok(ordenes.length >= 8, 'vw_totales_orden debe calcular totales y saldos de órdenes')

  const [facturas] = await pool.query('SELECT * FROM vw_totales_factura')
  assert.ok(facturas.length >= 4, 'vw_totales_factura debe clasificar facturas de cliente y seguro')

  const [liquidaciones] = await pool.query('SELECT * FROM vw_totales_liquidacion')
  assert.ok(liquidaciones.length >= 3, 'vw_totales_liquidacion debe sumar montos acordados')
})

test('3. Trigger de Subtipos Disjuntos: Impide que una factura de seguro se registre también como factura de cliente', async () => {
  await assert.rejects(
    async () => {
      await pool.query("INSERT INTO factura_cliente (numero_factura, id_orden) VALUES ('FAC-SEG-0003', 2)")
    },
    err => {
      assert.equal(err.sqlState, '45000')
      return true
    }
  )
})

test('4. Trigger de Agenda: Impide programar dos citas solapadas para el mismo vehículo', async () => {
  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO cita (matricula, fecha_inicio, fecha_fin, motivo, estado, id_usuario)
         VALUES ('GR 666006', '2026-11-08 09:30:00', '2026-11-08 10:30:00', 'Cita duplicada solapada', 'programada', 1)`
      )
    },
    err => {
      assert.equal(err.sqlState, '45000')
      return true
    }
  )
})

test.after(async () => {
  await pool.end()
})