const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process')
async function main(){
 if(process.env.QA_AUTH_AUDIT!=='1')throw new Error('Set QA_AUTH_AUDIT=1; only isolated QA preview is permitted.')
 const cfg=JSON.parse(await fs.readFile(path.join(__dirname,'../../artifacts/proformas/qa-database.json'),'utf8'));assert.match(cfg.database,/^taller_proformas_qa_\d+$/)
 require('dotenv').config({quiet:true});const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:cfg.database});
 const port='3004',base=`http://127.0.0.1:${port}`,results=[],tag=String(Date.now()).slice(-9)
 const server=spawn(process.execPath,[path.join(__dirname,'proformas-preview.cjs')],{cwd:path.join(__dirname,'..'),env:{...process.env,QA_PORT:port},stdio:'ignore',windowsHide:true})
 let token
 async function req(route,body,auth=true){const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth&&token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});return {status:r.status,data:await r.json()}}
 function note(check,r,expected){results.push({check,status:r.status,expected,ok:expected.includes(r.status),message:r.status>=400?r.data.message:undefined})}
 try{
  let ready=false
  for(let i=0;i<40;i++){if(server.exitCode!==null)throw new Error('QA server exited; stop rather than contact another server');try{await req('/api/ping');ready=true;break}catch{await new Promise(r=>setTimeout(r,250))}}
  assert.ok(ready)
  await db.query('UPDATE login_intento SET vence=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)')
  const credentials={email:'admin@tallerespinoza.com',password:'DemoProformas2026!'}
  const failed=[];for(let i=0;i<20;i++)failed.push((await req('/api/auth/login',{...credentials,password:'QA-incorrect-password'},false)).status)
  results.push({check:'20 intentos fallidos consecutivos: comprobar límite',statuses:failed,ok:failed.includes(429) || failed.includes(423)})
  assert.deepEqual(failed.slice(0,5),[401,401,401,401,401]);assert.ok(failed.slice(5).every(status=>status===429))
  assert.equal((await req('/api/auth/login',credentials,false)).status,429)
  await db.query('UPDATE login_intento SET vence=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)')
  const login=await req('/api/auth/login',credentials,false);assert.equal(login.status,200);token=login.data.token
  note('Login con correo rodeado de espacios',await req('/api/auth/login',{...credentials,email:` ${credentials.email} `},false),[200])
  note('Login con cuerpo JSON null',await req('/api/auth/login',null,false),[400])
  note('Login con intento de inyección SQL',await req('/api/auth/login',{email:"' OR 1=1 --",password:'bad'},false),[400,401])
  note('Acceso sin sesión',await req('/api/ordenes',undefined,false),[401])
  const original=token;token='not-a-valid-token';note('Token alterado',await req('/api/ordenes'),[401]);token=original
  note('Cerrar sesión',await req('/api/auth/logout',{}),[200]);note('Reutilizar token después de salir',await req('/api/ordenes'),[401])
  token=(await req('/api/auth/login',credentials,false)).data.token
  const client={nombre:'QA validación',cedula:`QA-${tag}`,telefono:'88880000',municipio_residencia:'Managua'}
  note('Cliente: nombre y municipio con solo espacios',await req('/api/clientes',{...client,nombre:'   ',municipio_residencia:'   '}),[400])
  note('Cliente: nacimiento en el futuro',await req('/api/clientes',{...client,cedula:`F-${tag}`,fecha_nacimiento:'2099-01-01'}),[400])
  note('Cliente: teléfono sin dígitos',await req('/api/clientes',{...client,cedula:`T-${tag}`,telefono:'abcdefgh'}),[400])
  note('Cliente: nombre supera 150 caracteres',await req('/api/clientes',{...client,cedula:`L-${tag}`,nombre:'A'.repeat(151)}),[400])
  note('Cliente: nombre de tipo numérico',await req('/api/clientes',{...client,cedula:`N-${tag}`,nombre:123}),[400])
  const car={id_cliente:1,matricula:`QA-${tag}`,marca:'Toyota',modelo:'Hilux',anio_fabricacion:2020,aseguradora:'ninguna',color:'Blanco'}
  note('Vehículo: marca y modelo con espacios',await req('/api/vehiculos',{...car,marca:'   ',modelo:'   '}),[400])
  note('Vehículo: año 2099',await req('/api/vehiculos',{...car,matricula:`F-${tag}`,anio_fabricacion:2099}),[400])
  note('Vehículo: cliente inexistente',await req('/api/vehiculos',{...car,matricula:`N-${tag}`,id_cliente:2147483647}),[400,404])
  note('Vehículo: aseguradora no admitida',await req('/api/vehiculos',{...car,matricula:`S-${tag}`,aseguradora:'desconocida'}),[400])
  note('Inventario: precio negativo',await req('/api/inventario',{nombre:'QA',precio_unidad:-1,cantidad:1,unidad_medida:'litro'}),[400])
  note('Inventario: nombre de tipo numérico',await req('/api/inventario',{nombre:123,precio_unidad:1,cantidad:1,unidad_medida:'litro'}),[400])
  const valid=await req('/api/clientes',{...client,cedula:`V-${tag}`});note('Cliente válido se registra',valid,[201])
  note('Cédula duplicada se rechaza',await req('/api/clientes',{...client,cedula:`V-${tag}`}),[409])
  note('Vehículo válido se registra',await req('/api/vehiculos',{...car,matricula:`V-${tag}`,id_cliente:valid.data.id}),[201])
  await db.query('UPDATE login_intento SET vence=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)')
  const burst=await Promise.all(Array.from({length:6},()=>req('/api/auth/login',{...credentials,password:'wrong'},false)))
  assert.equal(burst.filter(r=>r.status===401).length,5);assert.equal(burst.filter(r=>r.status===429).length,1)
  results.push({check:'Seis intentos simultáneos no evaden el límite de cinco',ok:true})
  await db.query('UPDATE login_intento SET vence=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)')
  for(let i=0;i<30;i++) assert.equal((await req('/api/auth/login',{email:`qa-${i}@example.invalid`,password:'wrong'},false)).status,401)
  note('Cambiar de correo no evade el límite por conexión',await req('/api/auth/login',{email:'qa-31@example.invalid',password:'wrong'},false),[429])
  await db.query('UPDATE login_intento SET vence=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)')
  note('El acceso se recupera al vencer la espera',await req('/api/auth/login',credentials,false),[200])
  await fs.mkdir(path.join(__dirname,'../../artifacts/qa'),{recursive:true})
  await fs.writeFile(path.join(__dirname,'../../artifacts/qa/auth-validation-check.json'),JSON.stringify({database:cfg.database,results},null,2))
  console.log(JSON.stringify(results,null,2))
  assert.ok(results.every(result=>result.ok), 'Hay comprobaciones fallidas')
 }finally{server.kill();await db.end()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
