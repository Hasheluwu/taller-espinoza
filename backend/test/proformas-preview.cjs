// Isolated demo server. Uses only the QA database created by proformas-mysql.cjs.
const fs=require('node:fs'),path=require('node:path'),{randomBytes}=require('node:crypto')
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../../artifacts/proformas/qa-database.json'),'utf8'))
if(!/^taller_proformas_qa_\d+$/.test(config.database))throw new Error('Expected an isolated QA database')
process.env.DB_NAME=config.database
process.env.PORT=process.env.QA_PORT || '3002'
process.env.ENABLE_DEBUG_RESET='false'
process.env.JWT_SECRET=randomBytes(32).toString('hex')
require('../src/index')
