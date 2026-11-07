# Taller Pedro Espinoza

Aplicación local con React/Vite, Express y MySQL. Los módulos actuales son clientes,
vehículos, presupuestos, órdenes, operaciones, inventario, repuestos y pagos.

## Iniciar o actualizar

1. Configurar `backend/.env` a partir de `backend/.env.example` con los datos de MySQL
   y un `JWT_SECRET` privado. No subir este archivo al repositorio.
2. Para una instalación NUEVA, crear las tablas con `taller_espinoza.sql`.
   No volver a ejecutar el esquema ni el reset sobre una instalación con datos.
3. En `backend`, ejecutar `npm install` y `npm start`.
   El inicio aplica la migración aditiva `migrations/001_sessions.sql`: crea la tabla
   de sesiones si falta, sin borrar las tablas ni registros existentes.
4. En `frontend`, ejecutar `npm install` y `npm run dev`.
   `VITE_API_URL` permite cambiar el backend; por defecto se usa `http://localhost:3001`.
5. Tras esta actualización, volver a iniciar sesión. Los tokens antiguos sin sesión
   y vencimiento dejan de aceptarse. Las nuevas sesiones duran 8 horas.

## Pagos y saldos

- El total definitivo procede de los cargos de las operaciones de la orden.
  El presupuesto vinculado es una referencia: no se copia automáticamente al cobro.
  Registrar los cargos reales antes de cobrar; un total vacío o cero no abre cobros.
- Adelanto, abono y saldo son etiquetas de un mismo historial. Todos reducen la deuda.
- En particulares, el cliente cubre el total. En órdenes aseguradas, cliente y seguro
  tienen partes separadas cuya suma debe coincidir con el total de la orden.
- Si falta esa distribución, Pagos ofrece un formulario para definirla.
- Un cobro al seguro pendiente reserva su importe pero NO se considera dinero recibido.
  Se confirma el mismo registro al recibirlo, sin duplicarlo.
- Al cubrir su parte se oculta el formulario de ese pagador y su botón de eliminar.
  Al cubrir ambas partes se muestra Pagado. El historial y los recibos siguen visibles.
- El backend bloquea el saldo durante cada operación y rechaza importes negativos,
  inválidos, con más de dos decimales o superiores al disponible.
- Excepción explícita para aseguradoras: administración puede confirmar un cobro
  superior al saldo con una justificación. Se muestra como excedente por conciliar
  del seguro; no cambia el total, la venta ni la ganancia. No se compensan deudas
  de un pagador con excedentes del otro. La devolución o aplicación a otra orden
  todavía requiere conciliación fuera de este flujo.
- Los cobros pendientes incorrectos pueden corregirse con motivo y auditoría,
  incluso en órdenes entregadas. Nunca se cambia automáticamente un pago recibido.
- Entregado y Pagado son estados distintos: una entrega no inventa un pago.
- Las órdenes antiguas con excesos no se corrigen automáticamente: muestran el exceso
  para revisión. No se borra dinero histórico ni se inventan devoluciones.

## Permisos y mantenimiento

Administración y secretaría pueden operar el taller. Solo administración puede hacer
ajustes manuales de stock, eliminar pagos en cuentas no pagadas y eliminar repuestos.
Las órdenes listas, entregadas o canceladas no admiten cambios en sus operaciones.
Cerrar sesión elimina la sesión del servidor; desactivar un usuario bloquea su acceso.

El reset destructivo está DESACTIVADO por defecto. Solo se monta con
`NODE_ENV=development` y `ENABLE_DEBUG_RESET=true`, y requiere un administrador.
No habilitarlo con datos reales. Ocultar un botón no sustituye este control.

## Verificación

- `cd backend` y `npm test`.
- `cd frontend` y `npm test`, `npm run build`, `npm run lint`.
- Las pruebas usan dependencias simuladas; no alteran la base de datos del taller.
  Antes de operar en producción, completar una prueba con una base de pruebas MySQL:
  cliente → vehículo → cargos → abonos → entrega, incluyendo dos cobros simultáneos.
- La revisión de lint no presenta errores ni advertencias. Aun así, queda como mejora
  de mantenimiento continuar separando las pantallas grandes por módulo.

## Respaldos

Guardar un respaldo de MySQL antes de actualizar una instalación con datos.
Por ejemplo, con la utilidad oficial instalada:
`mysqldump --single-transaction --routines --triggers -u USUARIO -p --result-file=respaldo.sql taller_espinoza`
El password se solicita de forma interactiva. Guardar el archivo fuera del repositorio.
Probar una restauración en una base separada antes de depender del respaldo.
Se implementó respaldo manual y verificación en una base separada. Consulta RESPALDO-Y-PRUEBAS.md para comandos y resultados. El respaldo diario lo hace la tarea de Windows `Respaldo diario Taller Espinoza` a las 18:00 (Nicaragua), con destino en el Escritorio de OneDrive y registro en `respaldo-diario.log`. Requiere la PC encendida y MySQL iniciado; consulta RESPALDO-Y-PRUEBAS.md.

## Alcance pendiente

Integración LAFISE, documentos distintos de fotos y contabilidad completa siguen
pendientes. Ver `arquitectura.md` para las ideas futuras; su texto histórico no es
una lista de funcionalidades terminadas. La guía anterior describe el comportamiento actual.

## Consumos, historial, agenda y fotos

- Inventario → Usar: selecciona una orden recibida/en proceso, cantidad y trabajador.
  Descuenta stock, registra el movimiento y lo vincula con la reparación. Las cantidades
  usan la unidad del producto (por ejemplo, 0.5 litros), con hasta dos decimales.
- Operaciones → Materiales + Personal: el trabajador es opcional para consumir;
  su monto es opcional y se guarda atómicamente si se añade al consumo. También
  existe Guardar solo mano de obra. No volver a registrar un monto ya acordado.
- Historial de vehículos muestra órdenes, servicios y materiales, con enlaces a
  operaciones, pagos y expediente. Se consulta por matrícula del vehículo registrado.
- Agenda permite crear, completar y cancelar citas; evita citas superpuestas del mismo
  vehículo. No reserva capacidad por mecánico. Las entregas previstas se editan en
  Fotos, costos y entrega dentro de cada orden y aparecen en la agenda.
- Expediente permite subir fotos JPEG/PNG/WebP de recepción o entrega, hasta 3 MB cada
  una. Se guardan en MySQL y requieren autenticación para verlas; el respaldo de la
  base incluye las fotos. No se usan carpetas públicas ni almacenamiento externo.
- Al reiniciar el backend se crean las tablas adicionales de forma repetible sin
  borrar registros. La cuenta de MySQL necesita permiso CREATE para esta actualización.

## Costos y liquidaciones por trabajo

- En el expediente, administración registra costos reales de materiales, repuestos
  y otros gastos. No se deducen automáticamente de los precios de venta del inventario.
  La mano de obra proviene de los montos acordados al personal. La ganancia estimada
  es venta sin IVA menos estos costos, no flujo de caja; antes de revisar costos no
  se presenta una ganancia ficticia. Los cambios de costos dejan auditoría.
- Liquidaciones es para administración: selecciona trabajador y trabajos de órdenes
  listas/entregadas, prepara una liquidación, y después confirma el pago realizado
  con fecha y referencia. Una asignación no puede incluirse en dos liquidaciones.
  Repetir la confirmación no duplica el pago. Es registro de pagos por trabajo,
  no transferencia bancaria ni cálculo de prestaciones por terminación de contrato.
- La referencia de pago queda en la auditoría. La corrección/anulación de una
  liquidación y la gestión de devoluciones no están incluidas en este primer flujo.

Pruebas de interfaz aisladas: `frontend/test/workshop-preview.html` con Vite activo.
Simula consumos, historial, agenda y expediente sin llamar a MySQL. Las pruebas
automáticas usan una base simulada; aún se necesita validar el despliegue con MySQL.

