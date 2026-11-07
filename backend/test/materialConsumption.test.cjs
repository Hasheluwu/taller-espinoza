const {test}=require('node:test')
const assert=require('node:assert/strict')
let state, before, failWorker=false
const dbPath=require.resolve('../src/db')
const conn={
 async beginTransaction(){before=structuredClone(state)},async commit(){},async rollback(){state=before},release(){},
 async query(sql,args=[]){
  if(sql.startsWith('SELECT * FROM orden'))return [[{id:1,estado:state.status}]]
  if(sql.startsWith('SELECT DISTINCT op.id_personal'))return [state.team]
  if(sql.startsWith('SELECT cantidad'))return [[{cantidad:state.stock,precio_unidad:100,vencido:state.expired ? 1 : 0}]]
  if(sql.includes('INSERT INTO orden_material')){state.materials.push({cantidad_usada:args[2],precio_unitario:args[3]});return [{insertId:1}]}
  if(sql.includes('INSERT INTO consumo_responsable')){if(failWorker)throw new Error('Worker write failed');state.responsible.push(args);return [{}]}
  if(sql.includes('INSERT INTO orden_personal')){if(failWorker)throw new Error('Worker write failed');state.labor.push(args);return [{}]}
  if(sql.includes('INSERT INTO movimiento_inventario')){state.movements.push(args);return [{}]}
  if(sql.includes('UPDATE inventario')){state.stock-=args[0];return [{}]}
  if(sql.startsWith('SELECT precio, aplica_iva'))return [[]]
  if(sql.startsWith('SELECT precio_unitario, cantidad_usada FROM orden_material'))return [state.materials]
  if(sql.startsWith('SELECT precio_unitario, cantidad_usada FROM orden_repuesto'))return [[]]
  if(sql.includes('AS total'))return [[{total:0}]]
  if(sql.startsWith('UPDATE orden SET subtotal')){state.total=args[2];return [{}]}
  if(sql.includes('SELECT om.*'))return [[{id:1,...state.materials[0]}]]
  throw new Error(sql)
 }
}
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{getConnection:async()=>conn}}
const router=require('../src/routes/operaciones')
async function consume(body){
 const res={code:200,status(n){this.code=n;return this},json(data){this.data=data;return this}}
 const handler=router.stack.find(l=>l.route?.path==='/:id_orden/materiales'&&l.route.methods.post).route.stack.at(-1).handle
 await handler({body,params:{id_orden:1},path:'/1/materiales',usuario:{id:1}},res)
 return res
}
function reset(status='en_proceso'){state={stock:2,status,materials:[],movements:[],responsible:[],labor:[],team:[{id_personal:2,nombre:'Ana'},{id_personal:3,nombre:'Luis'}]};failWorker=false}
test('one usable liter consumes one stock unit and links worker, order and ledger',async()=>{
 reset();const res=await consume({id_material:1,cantidad_usada:1,id_personal:2,nota:'Frenos'})
 assert.equal(res.code,201);assert.equal(state.stock,1);assert.equal(state.total,100);assert.equal(state.movements.length,1);assert.equal(state.responsible[0][1],2);assert.equal(state.labor.length,0)
})
test('a failed responsible record rolls back material and stock together',async()=>{
 reset();failWorker=true;const res=await consume({id_material:1,cantidad_usada:1,id_personal:2})
 assert.equal(res.code,400);assert.equal(state.stock,2);assert.equal(state.materials.length,0);assert.equal(state.responsible.length,0)
})
test('insufficient stock, closed orders and sub-cent quantities never consume inventory',async()=>{
 for(const [status,quantity] of [['en_proceso',3],['entregado',1],['en_proceso',0.001]]){
  reset(status);assert.equal((await consume({id_material:1,cantidad_usada:quantity,id_personal:2})).code,400);assert.equal(state.stock,2);assert.equal(state.materials.length,0)
 }
})

test('expired material cannot change stock, costs or movements',async()=>{
 reset();state.expired=true;const res=await consume({id_material:1,cantidad_usada:1,id_personal:2})
 assert.equal(res.code,400);assert.match(res.data.message,/vencido/);assert.equal(state.stock,2);assert.equal(state.materials.length,0);assert.equal(state.movements.length,0)
})

test('only a worker of the order team can use its materials',async()=>{
 reset();const res=await consume({id_material:1,cantidad_usada:1,id_personal:9})
 assert.equal(res.code,400);assert.match(res.data.message,/no está en el equipo/);assert.equal(state.stock,2);assert.equal(state.materials.length,0)
})
test('an order without a team cannot consume materials',async()=>{
 reset();state.team=[];const res=await consume({id_material:1,cantidad_usada:1,id_personal:2})
 assert.equal(res.code,400);assert.match(res.data.message,/no tiene trabajadores asignados/);assert.equal(state.stock,2)
})
test('a responsible worker is required',async()=>{
 reset();const res=await consume({id_material:1,cantidad_usada:1})
 assert.equal(res.code,400);assert.match(res.data.message,/Elige el trabajador/);assert.equal(state.stock,2)
})
test('a consumption never adds a labor charge',async()=>{
 reset();const res=await consume({id_material:1,cantidad_usada:1,id_personal:3,monto_acordado:500})
 assert.equal(res.code,201);assert.equal(state.labor.length,0);assert.equal(state.responsible[0][1],3)
})
