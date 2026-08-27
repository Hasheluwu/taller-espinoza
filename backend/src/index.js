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

const vehiculosRoutes = require('./routes/vehiculos')
app.use('/api/vehiculos', vehiculosRoutes)

const presupuestosRoutes = require('./routes/presupuestos')
app.use('/api/presupuestos', presupuestosRoutes)



const debugRouter = require('./routes/debug')
app.use('/api/debug', debugRouter)

const operacionesRoutes = require('./routes/operaciones')
const pagosRoutes       = require('./routes/pagos')

const ordenesRoutes = require('./routes/ordenes')
app.use('/api/ordenes', ordenesRoutes)

app.use('/api/operaciones', operacionesRoutes)
app.use('/api/pagos',       pagosRoutes)


const dashboardRoutes = require('./routes/dashboard')
app.use('/api/dashboard', dashboardRoutes)


app.get('/api/ping', (req, res) => {
  res.json({ message: 'Backend funcionando' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})