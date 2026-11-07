const {randomUUID}=require('node:crypto')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const base=`http://127.0.0.1:${process.env.QA_PORT || '3002'}`
async function main(){
 if(process.env.QA_HTTP_TEST !== '1') throw new Error('Solo QA: inicia proformas-preview.cjs y establece QA_HTTP_TEST=1. No ejecutar contra producción.')
 const config=JSON.parse(await fs.readFile(path.join(__dirname,'../../artifacts/proformas/qa-database.json'),'utf8'))
 assert.match(config.database,/^taller_proformas_qa_\d+$/)
 let token
 const results=[]
 async function request(route,body,auth=true){const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token&&auth?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});return {status:r.status,data:await r.json()}}
 assert.equal((await request('/api/ordenes',undefined,false)).status,401)
 const login=await request('/api/auth/login',{email:'admin@tallerespinoza.com',password:'DemoProformas2026!'},false)
 assert.equal(login.status,200);token=login.data.token
 results.push({check:'Autenticación real y bloqueo sin sesión',ok:true})
 const baseOrder={solicitud:randomUUID(),id_vehiculo:1,tipo:'mecanica',fecha_ingreso:'2026-11-03T10:00',tipo_pago:'particular',detalle_particular:{mano_obra_global:null,detalles:[{tipo_linea:'servicio',descripcion:'QA revisión',cantidad:1,precio_unitario:1000,aplica_iva:false}],observaciones:'Prueba aislada'}}
 const created=await request('/api/ordenes',baseOrder);assert.equal(created.status,201)
 for(const amount of [500,300,200])assert.equal((await request(`/api/pagos/${created.data.id}/cliente`,{monto:amount,tipo:'abono',metodo:'efectivo',fecha:'2026-11-03T10:00'})).status,201)
 const extra=await request(`/api/pagos/${created.data.id}/cliente`,{monto:1,tipo:'abono',metodo:'efectivo'})
 assert.ok(extra.status>=400);results.push({check:'Abonos 500 + 300 + 200 completan 1000; rechaza un pago extra',ok:true,status:extra.status})
 const warranty=await request('/api/ordenes',{...baseOrder,solicitud:randomUUID(),es_garantia:true,fecha_vencimiento_garantia:'2026-12-03'})
 assert.equal(warranty.status,201);assert.equal(Number(warranty.data.es_garantia),1);assert.ok(warranty.data.fecha_vencimiento_garantia)
 results.push({check:'Garantía y vencimiento guardados',ok:true})
 const reversed=await request('/api/ordenes',{...baseOrder,solicitud:randomUUID(),fecha_entrega_estimada:'2026-11-02'})
 assert.equal(reversed.status,400);results.push({check:'Rechaza entrega anterior al ingreso',ok:true})
 const payload={...baseOrder,solicitud:randomUUID()}
 const [first,retry]=await Promise.all([request('/api/ordenes',payload),request('/api/ordenes',payload)])
 assert.equal(first.data.id,retry.data.id);assert.ok(first.data.id)
 const later=await request('/api/ordenes',payload);assert.equal(later.data.id,first.data.id)
 assert.equal((await request('/api/ordenes',{...payload,tipo:'pintura'})).status,409)
 results.push({check:'Reintentos concurrentes y posteriores devuelven una sola orden; rechaza reutilización con otros datos',ok:true,id:first.data.id})
 for(const route of ['/api/ordenes?tipo_pago=particular','/api/taller/vehiculos','/api/taller/agenda?desde=2026-11-02&hasta=2026-11-08','/api/inventario','/api/proformas']){const r=await request(route);results.push({check:route,status:r.status,ok:r.status===200})}
 await fs.mkdir(path.join(__dirname,'../../artifacts/qa'),{recursive:true})
 await fs.writeFile(path.join(__dirname,'../../artifacts/qa/system-check.json'),JSON.stringify(results,null,2))
 console.log(JSON.stringify(results,null,2))
}
main().catch(e=>{console.error(e);process.exitCode=1})
