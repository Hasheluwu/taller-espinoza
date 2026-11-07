// Backup first; apply only additive migrations to the configured database.
const fs=require('node:fs/promises'),path=require('node:path'),mysql=require('mysql2')
const pool=require('../src/db')
async function main(){
 const conn=await pool.getConnection()
 try{
  const [[database]]=await conn.query('SELECT DATABASE() AS name')
  const [tables]=await conn.query('SHOW FULL TABLES WHERE Table_type=\'BASE TABLE\'')
  await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
  await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT')
  const sections=['-- Respaldo antes de integrar Proformas. Restaurar en una base vacía.','SET FOREIGN_KEY_CHECKS=0;']
  const counts={}
  for(const row of tables){
   const table=Object.values(row)[0],escaped=mysql.escapeId(table)
   const [[ddl]]=await conn.query(`SHOW CREATE TABLE ${escaped}`)
   sections.push(ddl['Create Table']+';')
   const [rows]=await conn.query(`SELECT * FROM ${escaped}`);counts[table]=rows.length
   for(const record of rows) sections.push(`INSERT INTO ${escaped} (${Object.keys(record).map(k=>mysql.escapeId(k)).join(',')}) VALUES (${Object.values(record).map(v=>mysql.escape(v)).join(',')});`)
  }
  sections.push('SET FOREIGN_KEY_CHECKS=1;')
  const dir=path.join(__dirname,'../../.private-backups')
  await fs.mkdir(dir,{recursive:true})
  const filename=path.join(dir,`pre-proformas-${Date.now()}.sql`)
  await fs.writeFile(filename,sections.join('\n'),'utf8')
  await conn.commit()
  await require('../src/services/migrate')(pool)
  // Verify that every pre-existing table retained its number of records.
  for(const [table,count] of Object.entries(counts)){
   if(['sesion_usuario','proforma_secuencia'].includes(table))continue
   const [[now]]=await pool.query(`SELECT COUNT(*) AS n FROM ${mysql.escapeId(table)}`)
   if(Number(now.n)!==count)throw new Error(`Revisar conteo de ${table}: antes=${count}, después=${now.n}`)
  }
  console.log(JSON.stringify({database:database.name,backup:filename,tables:tables.length,status:'Migración aplicada; conteos previos conservados.'},null,2))
 }catch(e){await conn.rollback();throw e}finally{conn.release();await pool.end()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
