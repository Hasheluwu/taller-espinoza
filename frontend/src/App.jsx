// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Layout                  from './components/Layout'
import Login                   from './pages/Login'
import Dashboard               from './pages/Dashboard'
import IngresarOrden           from './pages/IngresarOrden'
import IngresarOrdenVehiculo   from './pages/IngresarOrdenVehiculo'
import IngresarOrdenPresupuesto from './pages/IngresarOrdenPresupuesto'
import IngresarOrdenFinal      from './pages/IngresarOrdenFinal'
import VerOrdenes              from './pages/VerOrdenes'
import Operaciones             from './pages/Operaciones'
import Pagos                   from './pages/Pagos'
import Inventario              from './pages/Inventario'
import Repuestos               from './pages/Repuestos'
import Historial from './pages/Historial'
import Agenda from './pages/Agenda'
import Expediente from './pages/Expediente'
import Liquidaciones from './pages/Liquidaciones'

// ─── ruta protegida ───────────────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

// ─── ruta pública (redirige si ya hay token) ──────────────────────────────────
function PublicRoute({ children }) {
  const token = localStorage.getItem('token')
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/liquidaciones" element={<PrivateRoute><Liquidaciones /></PrivateRoute>} />
        <Route path="/historial" element={<PrivateRoute><Historial /></PrivateRoute>} />
        <Route path="/agenda" element={<PrivateRoute><Agenda /></PrivateRoute>} />
        <Route path="/ordenes/:id/expediente" element={<PrivateRoute><Expediente /></PrivateRoute>} />

        {/* ── pública ── */}
        <Route path="/login" element={
          <PublicRoute><Login /></PublicRoute>
        } />

        {/* ── protegidas — el sidebar viene incluido via PrivateRoute → Layout ── */}

        <Route path="/dashboard" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />

        {/* flujo ingresar orden — orden IMPORTA: estáticas antes que dinámicas */}
        <Route path="/ordenes/nueva" element={
          <PrivateRoute><IngresarOrden /></PrivateRoute>
        } />
        <Route path="/ordenes/nueva/vehiculo" element={
          <PrivateRoute><IngresarOrdenVehiculo /></PrivateRoute>
        } />
        <Route path="/ordenes/nueva/presupuesto" element={
          <PrivateRoute><IngresarOrdenPresupuesto /></PrivateRoute>
        } />
        <Route path="/ordenes/nueva/orden" element={
          <PrivateRoute><IngresarOrdenFinal /></PrivateRoute>
        } />

        {/* órdenes — estáticas primero */}
        <Route path="/ordenes" element={
          <PrivateRoute><VerOrdenes /></PrivateRoute>
        } />

        {/* dinámicas siempre al final */}
        <Route path="/ordenes/:id/operaciones" element={
          <PrivateRoute><Operaciones /></PrivateRoute>
        } />
        <Route path="/ordenes/:id/pago" element={
          <PrivateRoute><Pagos /></PrivateRoute>
        } />

        <Route path="/inventario" element={
          <PrivateRoute><Inventario /></PrivateRoute>
        } />

        <Route path="/repuestos" element={
          <PrivateRoute><Repuestos /></PrivateRoute>
        } />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />

      </Routes>
    </BrowserRouter>
  )
}
