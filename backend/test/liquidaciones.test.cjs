const {test}=require('node:test'),assert=require('node:assert/strict')
let state,queue
const path=require.resolve('../src/db')
const pool={async getConnection(){let release,before;return {
 async beginTransaction(){const previous=queue;queue=new Promise(r=>release=r);await previous;before=structuredClone(state)},
 async commit(){},async rollback(){state=before},release(){release()},
 async query(sql,args=[]){
  if(sql.startsWith('SET TRANSACTION'))return [{}]
  if(sql.startsWith('SELECT id FROM personal'))return [[{id:1}]]
  if(sql.startsWith('SELECT op.*'))return [[{id:1,id_personal:1,estado:state.orderStatus,monto_acordado:1500}]]
  if(sql.startsWith('SELECT id FROM liquidacion_detalle'))return [state.details.filter(x=>x[1]===args[0])]
  if(sql.startsWith('INSERT INTO liquidacion_personal')){const id=state.payroll.length+1;state.payroll.push({id,id_personal:args[0],monto_total:args[2],pagado:false});return [{insertId:id}]}
  if(sql.startsWith('INSERT INTO liquidacion_detalle')){state.details.push(args);return [{}]}
  if(sql.startsWith('SELECT * FROM liquidacion_personal'))return [state.payroll.filter(x=>x.id===args[0])]
  if(sql.startsWith('UPDATE liquidacion_personal')){state.payroll.find(x=>x.id===args[1]).pagado=true;return [{}]}
  if(sql.startsWith('INSERT INTO auditoria')){if(state.failAudit)throw new Error('Audit failed');state.audit.push(args);return [{}]}
  throw new Error(sql)
 }
}}}
require.cache[path]={id:path,filename:path,loaded:true,exports:pool}
const router=require('../src/routes/liquidaciones')
function reset(){queue=Promise.resolve();state={details:[],payroll:[],audit:[],orderStatus:'listo'}}
async function request(method,path,body,params={}){const res={code:200,status(n){this.code=n;return this},json(data){this.data=data;return this}};await router.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle({body,params,usuario:{id:1}},res,e=>{res.code=e.status||500;res.data={message:e.message}});return res}
const prepare={id_personal:1,asignaciones:[1],fecha:'2026-10-06'}
test('concurrent payroll preparation cannot include the same job twice',async()=>{reset();const result=await Promise.all([request('post','/',prepare),request('post','/',prepare)]);assert.deepEqual(result.map(r=>r.code).sort(),[200,409]);assert.equal(state.payroll.length,1);assert.equal(state.payroll[0].monto_total,1500)})
test('payroll payment is idempotent and retains exactly one payment audit',async()=>{reset();await request('post','/',prepare);for(let i=0;i<2;i++)assert.equal((await request('patch','/:id/pagar',{fecha_pago:'2026-10-06',referencia:'Transferencia ABC'},{id:1})).code,200);assert.equal(state.payroll[0].pagado,true);assert.equal(state.audit.length,2)})
test('unfinished jobs and audit failure cannot create payable payroll',async()=>{reset();state.orderStatus='en_proceso';assert.equal((await request('post','/',prepare)).code,409);assert.equal(state.payroll.length,0);state.orderStatus='listo';state.failAudit=true;assert.equal((await request('post','/',prepare)).code,500);assert.equal(state.payroll.length,0);assert.equal(state.details.length,0)})
