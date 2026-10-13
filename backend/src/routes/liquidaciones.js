const express=require('express')
const pool=require('../db')
const auth=require('../middleware/authMiddleware')
const {fail,number,cents}=require('../services/validation')
const {date}=require('../services/workshop')
const router=express.Router()
router.use(auth,auth.admin)
const run=action=>async(req,res,next)=>{let conn;try{conn=await pool.getConnection();await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await conn.beginTransaction();const result=await action(conn,req);await conn.commit();res.json(result)}catch(e){if(conn)await conn.rollback();next(e)}finally{if(conn)conn.release()}}
const audit=(conn,req,id,detail)=>conn.query('INSERT INTO auditoria (id_usuario,tabla,id_registro,accion,detalle) VALUES (?,?,?,?,?)',[req.usuario.id,'liquidacion_personal',id,'editar',detail])
router.get('/:id_personal',run(async(conn,req)=>{
 const person=number(req.params.id_personal,'Trabajador',{positive:true,integer:true})
 const [trabajos]=await conn.query(`SELECT op.*,o.estado,v.matricula,ld.id_liquidacion FROM orden_personal op JOIN orden o ON o.id=op.id_orden JOIN vehiculo v ON v.id=o.id_vehiculo LEFT JOIN liquidacion_detalle ld ON ld.id_orden_personal=op.id WHERE op.id_personal=? ORDER BY op.id DESC`,[person])
 const [liquidaciones]=await conn.query('SELECT * FROM liquidacion_personal WHERE id_personal=? ORDER BY id DESC',[person])
 for(const liq of liquidaciones){const [details]=await conn.query('SELECT op.id_orden,op.monto_acordado FROM liquidacion_detalle ld JOIN orden_personal op ON op.id=ld.id_orden_personal WHERE ld.id_liquidacion=?',[liq.id]);liq.trabajos=details}
 return {trabajos,liquidaciones}
}))
router.post('/',run(async(conn,req)=>{
 const person=number(req.body.id_personal,'Trabajador',{positive:true,integer:true})
 const fecha=date(req.body.fecha)
 const ids=req.body.asignaciones
 if(!Array.isArray(ids)||!ids.length||ids.length>200)fail('Selecciona de 1 a 200 trabajos.')
 const unique=[...new Set(ids.map(v=>number(v,'Trabajo',{positive:true,integer:true})))].sort((a,b)=>a-b)
 if(unique.length!==ids.length)fail('Hay trabajos repetidos.')
 const [[worker]]=await conn.query('SELECT id FROM personal WHERE id=? FOR UPDATE',[person])
 if(!worker)fail('Trabajador no encontrado.',404)
 let total=0
 for(const item of unique){
  const [[assignment]]=await conn.query('SELECT op.*,o.estado FROM orden_personal op JOIN orden o ON o.id=op.id_orden WHERE op.id=? FOR UPDATE',[item])
  if(!assignment || assignment.id_personal!==person)fail('El trabajo no pertenece al trabajador.',409)
  if(!['listo','entregado'].includes(assignment.estado))fail('Solo se liquidan trabajos de órdenes listas o entregadas.',409)
  const [existing]=await conn.query('SELECT id FROM liquidacion_detalle WHERE id_orden_personal=?',[item])
  if(existing.length)fail('Uno de los trabajos ya pertenece a una liquidación.',409)
  total+=cents(assignment.monto_acordado)
 }
 if(!total)fail('Los trabajos deben tener un monto acordado mayor que cero.')
 const [result]=await conn.query('INSERT INTO liquidacion_personal (id_personal,fecha,monto_total,pagado) VALUES (?,?,?,FALSE)',[person,fecha,total/100])
 for(const item of unique)await conn.query('INSERT INTO liquidacion_detalle (id_liquidacion,id_orden_personal) VALUES (?,?)',[result.insertId,item])
 await audit(conn,req,result.insertId,`Liquidación preparada por C$ ${total/100}; trabajos ${unique.join(', ')}`)
 return {id:result.insertId,monto_total:total/100}
}))
router.patch('/:id/pagar',run(async(conn,req)=>{
 const id=number(req.params.id,'Liquidación',{positive:true,integer:true})
 const fecha=date(req.body.fecha_pago)
 if(typeof req.body.referencia!=='string'||req.body.referencia.trim().length<3||req.body.referencia.length>500)fail('Indica el comprobante o referencia del pago.')
 const [[row]]=await conn.query('SELECT * FROM liquidacion_personal WHERE id=? FOR UPDATE',[id])
 if(!row)fail('Liquidación no encontrada.',404)
 if(row.pagado)return {message:'Esta liquidación ya está pagada.'}
 await conn.query('UPDATE liquidacion_personal SET pagado=TRUE,fecha_pago=? WHERE id=?',[fecha,id])
 await audit(conn,req,id,`Pagada C$ ${row.monto_total} el ${fecha}; comprobante: ${req.body.referencia.trim()}`)
 return {message:'Pago al trabajador registrado.'}
}))
module.exports=router
