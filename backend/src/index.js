const express = require('express')
const cors    = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))
app.use('/api/taller', require('./routes/taller'))
app.use('/api/liquidaciones', require('./routes/liquidaciones'))

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



// Reset de datos desactivado salvo habilitación explícita en desarrollo.
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_RESET === 'true') {
  app.use('/api/debug', require('./routes/debug'))
}

const operacionesRoutes = require('./routes/operaciones')
const pagosRoutes       = require('./routes/pagos')

const ordenesRoutes = require('./routes/ordenes')
app.use('/api/ordenes', ordenesRoutes)

app.use('/api/operaciones', operacionesRoutes)
app.use('/api/pagos',       pagosRoutes)


const dashboardRoutes = require('./routes/dashboard')
app.use('/api/dashboard', dashboardRoutes)

const proveedoresRoutes = require('./routes/proveedores')
app.use('/api/proveedores', proveedoresRoutes)

const inventarioRoutes = require('./routes/inventario')
app.use('/api/inventario', inventarioRoutes)

const repuestosRoutes = require('./routes/repuestos')
app.use('/api/repuestos', repuestosRoutes)


app.get('/api/ping', (req, res) => {
  res.json({ message: 'Backend funcionando' })
})

app.use('/api', (req, res) => res.status(404).json({ message: 'Ruta no encontrada.' }))
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  console.error(err)
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno del servidor.' })
})

const PORT = process.env.PORT || 3001
require('./services/migrate')(require('./db'))
  .then(() => app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`)))
  .catch(err => { console.error('No se pudo preparar la base de datos:', err.message); process.exitCode = 1; require('./db').end() })
