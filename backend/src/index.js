const express = require('express')
const cors    = require('cors')
require('dotenv').config()

const { allowedOrigin, headers } = require('./middleware/security')

const app = express()
app.disable('x-powered-by')
app.use(headers)
app.use(cors({ origin: (origin, done) => done(null, allowedOrigin(origin)) }))
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
app.use('/api/proformas', require('./routes/proformas'))
app.use('/api/cotizaciones', require('./routes/proformas'))



// Reset de datos desactivado salvo habilitación explícita en desarrollo.
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_RESET === 'true') {
  app.use('/api/debug', require('./routes/debug'))
}

const operacionesRoutes = require('./routes/operaciones')
const pagosRoutes       = require('./routes/pagos')

const ordenesRoutes = require('./routes/ordenes')
app.use('/api/ordenes-borrador', require('./routes/ordenBorradores'))
app.use('/api/ordenes', ordenesRoutes)

app.use('/api/operaciones', operacionesRoutes)
app.use('/api/pagos',       pagosRoutes)
app.use('/api/facturas', require('./routes/facturas'))


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
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Los datos enviados no tienen un formato válido. Revisa el formulario.' })
  console.error(err)
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno del servidor.' })
})

const PORT = process.env.PORT || 3001
require('./services/migrate')(require('./db'))
  .then(() => app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
    require('./services/securityCheck')(require('./db')).catch(err => console.warn('[SEGURIDAD] No se pudo revisar la configuración:', err.message))
  }))
  .catch(err => {
    const causes = err.errors || [err]
    const code = err.code || causes.find(cause => cause.code)?.code || 'ERROR_DB'
    const guidance = {
      ECONNREFUSED: 'MySQL no está disponible. Inicia el servicio de MySQL y verifica DB_HOST y DB_PORT en .env.',
      ER_ACCESS_DENIED_ERROR: 'MySQL rechazó las credenciales. Revisa DB_USER y DB_PASSWORD en .env.',
      ER_BAD_DB_ERROR: 'La base de datos configurada no existe. Revisa DB_NAME y la importación inicial.',
      ETIMEDOUT: 'Se agotó el tiempo de conexión a MySQL. Revisa el servicio y la dirección configurada.',
    }
    console.error(`No se pudo preparar la base de datos [${code}]: ${guidance[code] || err.message || 'Error sin descripción. Revisa la conexión y las migraciones.'}`)
    process.exitCode = 1
    require('./db').end()
  })
