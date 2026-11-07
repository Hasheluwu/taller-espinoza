const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const service = require('../services/insuranceInvoices')
const { lockOrder, fail } = require('../services/validation')
const router = express.Router()
router.use(auth)
router.use((req,res,next) => ['administrador','secretaria'].includes(req.usuario.rol) ? next() : res.status(403).json({message:'No tienes permiso para gestionar facturas.'}))
function run(fn) { return async (req,res,next) => {
  let conn
  try { conn=await pool.getConnection(); await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'); await conn.beginTransaction(); const result=await fn(conn,req); await conn.commit(); res.json(result) }
  catch(e) { if(conn) await conn.rollback(); next(e) } finally { conn?.release() }
} }
router.get('/',run(async (conn,req) => {
  const state=req.query.estado || 'pendiente'
  if(!['pendiente','pagada','sin_factura'].includes(state)) fail('Estado de factura inválido.')
  // Insured cars delivered before invoices were issued automatically: listed for review, never invoiced silently.
  const missing=`FROM orden o JOIN vehiculo v ON v.id=o.id_vehiculo JOIN cliente c ON c.id=v.id_cliente WHERE o.estado='entregado' AND o.tipo_pago IN ('lafise','iniser') AND NOT EXISTS (SELECT 1 FROM factura_seguro f WHERE f.id_orden=o.id)`
  const [rows]=state==='sin_factura'
    ? await conn.query(`SELECT o.id AS id_orden,o.tipo_pago AS aseguradora,o.monto_seguro,o.fecha_entrega_real,c.nombre cliente,v.matricula ${missing} ORDER BY o.id DESC`)
    : await conn.query(`SELECT f.id,f.id_orden,f.aseguradora,f.total,f.saldo_inicial,f.estado,f.fecha_emision,f.fecha_pago,JSON_UNQUOTE(JSON_EXTRACT(f.documento,'$.cliente')) cliente,JSON_UNQUOTE(JSON_EXTRACT(f.documento,'$.vehiculo.matricula')) matricula FROM factura_seguro f WHERE estado=? ORDER BY id DESC`,[state])
  const [[totals]]=await conn.query("SELECT COALESCE(SUM(CASE WHEN estado='pendiente' THEN saldo_inicial ELSE 0 END),0) pendiente,COALESCE(SUM(CASE WHEN estado='pagada' THEN total ELSE 0 END),0) pagado,SUM(estado='pendiente') facturas_pendientes,SUM(estado='pagada') facturas_pagadas FROM factura_seguro")
  const [[{sin_factura}]]=await conn.query(`SELECT COUNT(*) sin_factura ${missing}`)
  return {rows,totals:{...totals,facturas_pendientes:Number(totals.facturas_pendientes || 0),facturas_pagadas:Number(totals.facturas_pagadas || 0),sin_factura:Number(sin_factura)}}
}))
router.get('/orden/:id',run(async (conn,req) => {
  const order=await lockOrder(conn,req.params.id)
  const invoice=await service.existing(conn,order.id)
  return invoice || {estado:'vista_previa',id_orden:order.id,documento:await service.preview(conn,order),puede_emitir:['listo','entregado'].includes(order.estado)}
}))
router.post('/orden/:id',run((conn,req)=>service.issue(conn,req.params.id,req.usuario.id)))
router.post('/orden/:id/pagar',run((conn,req)=>service.pay(conn,req.params.id,req.body,req.usuario.id)))
module.exports=router
