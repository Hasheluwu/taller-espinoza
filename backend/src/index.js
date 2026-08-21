const express = require('express')
const cors    = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

// Agrega estas dos líneas en backend/src/index.js,
// después de las líneas existentes de app.use(cors()) y app.use(express.json())

const authRoutes = require('./routes/auth')
app.use('/api/auth', authRoutes)

// ─── 1. En backend/src/index.js, agrega estas dos líneas ─────────────────────

const clientesRoutes = require('./routes/clientes')
app.use('/api/clientes', clientesRoutes)

app.get('/api/ping', (req, res) => {
  res.json({ message: 'Backend funcionando' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})