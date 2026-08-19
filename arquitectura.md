---

# INFORME DE ARQUITECTURA DE INTERFAZ — versión 2

---

**Login**

Pantalla única de entrada. Email y contraseña. Sin registro público. Las credenciales del primer usuario se insertan directamente en la base de datos al momento del deploy. El rol del usuario determina qué ve en el menú. Por ahora todos los roles tienen acceso completo, pero el campo `rol` en `usuario` deja abierta la puerta a restringir rutas por rol en el futuro sin cambiar el schema. Hoy opera con un único usuario real: la administradora, que concentra todos los roles operativos del negocio.

---

**Dashboard**

La pantalla principal después de login. No es una ruta de acción sino de resumen. Muestra en cards o contadores: órdenes activas agrupadas por estado, cobros pendientes de aseguradora, materiales con cantidad baja según su `stock_minimo`, liquidaciones pendientes al personal. Todo esto son queries simples sobre tablas existentes. Desde aquí se accede al menú con las 8 rutas principales.

---

**Ruta 1 — Ingresar Orden**

El flujo tiene cuatro pasos en secuencia dentro de la misma ruta.

Paso 1: búsqueda de cliente por cédula. Si existe, carga sus datos y avanza. Si no existe, muestra el formulario de cliente: nombre, cédula, teléfono, fecha_nacimiento (opcional), municipio_residencia, dirección (opcional). Al enviar, crea el cliente y avanza.

Paso 2: búsqueda de vehículo por matrícula. Si existe y pertenece al cliente cargado, avanza. Si no existe, muestra el formulario de vehículo: matrícula, marca, modelo, año_fabricacion, aseguradora, color, chasis (opcional), motor (opcional). Al enviar, crea el vehículo vinculado al cliente y avanza.

Paso 3 (opcional, recomendado para aseguradoras): creación de presupuesto. El sistema pregunta si se desea crear un presupuesto antes de abrir la orden. Si el cliente aún no ha aprobado nada, se puede registrar el presupuesto, imprimirlo y esperar. Si el cliente ya aprobó (regresó con la orden de la aseguradora), este paso se omite o se vincula el presupuesto ya existente. El formulario de presupuesto permite agregar líneas de tipo servicio, material o repuesto, con cantidad y precio unitario, y un checkbox de aplica_iva por línea. El sistema calcula subtotal, IVA y total automáticamente. El presupuesto queda en estado `pendiente` hasta que se marque como `aprobado` o `rechazado`. Al aprobarlo, el sistema crea automáticamente la orden vinculada y copia las líneas a `orden_servicio`.

Paso 4: formulario de la orden. Campos: tipo (enum con selector), fecha_ingreso (pre-llenada con fecha y hora actual, editable), fecha_entrega_estimada (opcional), tipo_pago (si es particular se ocultan campos de seguro; si es lafise o iniser se muestran numero_tramite y numero_orden_seguro), es_garantia (si es true aparece selector de orden origen), obra_externa, obra_interna. El estado arranca en `recibido` automáticamente. Los costos se calculan desde las líneas de `orden_servicio` y operaciones posteriores. `danos_ocultos` arranca en false y el sistema lo activa automáticamente cuando se registra el primer daño oculto vinculado a esa orden.

Al crear la orden exitosamente el sistema ofrece dos opciones: ir a Ver Órdenes, o ir directamente a las Operaciones de esa orden.

---

**Ruta 2 — Ver Órdenes**

Grid de tarjetas. Cada tarjeta muestra: matrícula, nombre del cliente, tipo de orden, estado con color (recibido = gris, en_proceso = amarillo, listo = verde, entregado = azul, cancelado = rojo), fecha de ingreso, tipo de pago. Los botones disponibles en cada tarjeta son: Ver detalle, Operaciones, Ingresar pago. Si la orden tiene tipo_pago = lafise y tiene al menos una operación registrada, aparece también: Linker LAFISE.

Filtros disponibles: por estado, por tipo, por tipo_pago, por es_garantia, por obra_externa, obra_interna, por danos_ocultos, por rango de fecha_ingreso, por fecha_entrega_estimada, por costo de mayor a menor. Búsqueda por cédula del cliente, nombre del cliente, matrícula del vehículo.

Filtro rápido predeterminado: órdenes activas (estado distinto de `entregado` y `cancelado`) ordenadas por antigüedad.

Al pulsar Ver detalle se abre una vista expandida con todos los campos de la orden, los pagos registrados, las líneas de `orden_servicio`, los materiales y repuestos usados, la media adjunta y los daños ocultos si los hay.

---

**Ruta 3 — Inventario**

Vista principal en grid de productos. Cada tarjeta muestra: nombre, nombre del proveedor, cantidad disponible con indicador visual si está por debajo del `stock_minimo`. Al pulsar una tarjeta se abre un modal con todos los campos: unidad_medida, precio_unidad, stock_minimo, fecha_expiracion.

Importante: la cantidad del inventario ya no se edita directamente desde este modal. Toda entrada de mercadería se hace a través del botón Registrar compra, que crea el registro en `compra_inventario` y genera automáticamente el movimiento de entrada en `movimiento_inventario`. Los ajustes manuales (correcciones de conteo físico) también pasan por un formulario de ajuste que crea el movimiento correspondiente con tipo `ajuste_manual` y deja nota del motivo. Esto garantiza que el historial de inventario sea completo y auditable.

Botón principal: Agregar producto. Abre formulario con todos los campos de inventario más selección o creación del proveedor. Al seleccionar proveedor aparecen primero los que tienen `fijo = true`. Si el proveedor no está, se puede crear en el momento con `fijo = false` por defecto.

Botón secundario: Crear proveedor fijo. Formulario con nombre, contacto, emite_factura_iva. Estos proveedores aparecen como opciones rápidas en cualquier selector de proveedor del sistema.

Sección de proveedores fijos visible en la misma ruta en flex-row con cards simples mostrando nombre y si emite IVA.

Filtros de productos: por proveedor, por unidad_medida, por cantidad baja (menor o igual a stock_minimo), por fecha_expiracion próxima, por tiene o no proveedor. Búsqueda por nombre de producto o nombre de proveedor.

---

**Ruta 4 — Repuestos**

Layout dividido en dos mitades horizontales con scroll independiente.

Mitad izquierda — repuesto_taller: grid de piezas del taller. Cada tarjeta muestra: nombre, marca, modelo, cantidad, estado. Al pulsar, modal con todos los campos. Botón de agregar repuesto_taller. Botón de tres puntos para eliminar o editar. Filtros: por estado, por origen, por modelo_compatible, por marca. Búsqueda por nombre, marca, modelo.

Mitad derecha — repuesto_cliente: grid de piezas de clientes. Cada tarjeta muestra: nombre, marca, modelo, estado, matrícula del vehículo al que pertenece (obtenida a través de la orden). Al pulsar, modal con todos los campos incluyendo la orden vinculada y el cliente. Desde el modal se puede cambiar el estado a `devuelto` o `transferido_a_taller`. Al seleccionar `transferido_a_taller`, el backend ejecuta una transacción atómica que cambia el estado del repuesto_cliente y crea automáticamente un registro en repuesto_taller con origen `proveniente_de_cliente`. No se puede eliminar un repuesto_cliente, solo cambiar su estado. Filtros por estado, por marca. Búsqueda por nombre, matrícula, cédula del cliente, nombre del cliente.

---

**Operaciones de una Orden**

Accesible desde el botón Operaciones en cada tarjeta de Ver Órdenes. Muestra el encabezado de la orden (matrícula, cliente, tipo, estado) y un conjunto de secciones expandibles o pestañas.

Servicios / Líneas de cobro: siempre disponible. Aquí se agregan o editan las líneas de `orden_servicio`: descripción del servicio, precio, y si aplica IVA. Esta sección alimenta la proforma, el presupuesto y la factura final. Es la mano de obra y servicios que se le cobran al cliente (distinto de lo que se le paga al trabajador).

Materiales: siempre disponible. Selección del material por nombre, ingreso de cantidad_usada. Al guardar, el sistema descuenta del inventario vía `movimiento_inventario` tipo `salida_orden` de forma atómica. Guarda el precio_unitario como snapshot en el momento del uso.

Repuestos: siempre disponible. Mismo flujo que materiales pero sobre repuesto_taller.

Personal: disponible según obra_externa u obra_interna. Selector de personal con los de `fijo = true` como opciones rápidas. Se registra el monto acordado por ese trabajo en `orden_personal`.

Daños ocultos: disponible para cualquier tipo de orden. Para órdenes de tipo lafise o iniser, el formulario muestra los campos de aplica_seguro, monto_cubierto_seguro y monto_extra_cliente, y el daño oculto queda registrado en `orden_dano_oculto` en estado `pendiente` para gestión con la aseguradora. Para órdenes de clientes particulares, si aparece un daño oculto se tramita como una orden nueva vinculada con `id_orden_origen`, negociada directamente con el cliente como una orden normal. El sistema ofrece el acceso directo a crear esa orden vinculada desde este mismo panel.

Media: disponible en cualquier momento. Subida de archivos con selector de tipo y categoría. Los archivos van a Cloudflare R2 y se guarda la URL en `orden_media`. El campo `subido_por` registra el usuario que subió el archivo.

Al finalizar cualquier operación, el sistema pregunta si se desea ingresar un pago. Si sí, abre el formulario de pago. Si no, regresa a la vista de la orden.

---

**Pagos**

Accesible desde el botón Ingresar pago en cada tarjeta de orden o como continuación de una operación. Formulario con: monto, fecha (pre-llenada con hoy), tipo (adelanto, abono, saldo), metodo (efectivo, transferencia, otro), numero_recibo (correlativo del talonario físico). Si la orden es lafise o iniser aparece también la sección de pago_seguro para registrar cuando llegó el depósito de la aseguradora, incluyendo el campo `concepto` (pago_principal, dano_oculto, otro) para los casos en que llegan pagos adicionales por daños ocultos aprobados.

El sistema muestra siempre el resumen de pagos de la orden: total pagado, total pendiente, desglosado por tipo.

Cada pago genera automáticamente un recibo en PDF con los datos del cliente, la orden y el monto. El PDF se guarda en `orden_media` con categoría `recibo`.

La factura final se genera cuando el estado de la orden cambia a `entregado`. Consolida líneas de `orden_servicio`, materiales, repuestos y total con IVA desglosado. El campo `numero_factura_fisica` se llena en ese momento.

La proforma se puede generar en cualquier momento desde el detalle de la orden con los datos ya ingresados.

---

**Ruta 5 — Liquidaciones**

Grid de personal con trabajos registrados en `orden_personal` sin liquidar. Cada tarjeta muestra: nombre del personal, rol, total acumulado pendiente. Al pulsar se abre el detalle con la lista de órdenes en las que trabajó y el monto por cada una. Desde ahí se seleccionan las órdenes a incluir, el sistema suma el total y crea el registro en `liquidacion_personal` con sus `liquidacion_detalle`. Una vez pagado se marca la liquidación como pagada.

Un `orden_personal` ya incluido en una liquidación pagada no puede incluirse en otra liquidación. El estado de pago de un `orden_personal` se deriva exclusivamente de si está en el detalle de una liquidación con `pagado = true`, no de ningún campo local.

Sección de historial de liquidaciones pasadas con filtros por persona y por fecha.

---

**Ruta 6 — Linker LAFISE**

Accesible desde el botón en cada tarjeta de orden que aplique. Muestra un formulario pre-llenado con los datos que el sistema ya tiene: número de trámite y número de orden de compra (de la orden), placa, chasis y motor (del vehículo), nombre del cliente. Solo se ingresan manualmente: número de reclamo y observaciones. Los campos que se exportan a Linker se guardan como snapshot en `linker_lafise` para conservar exactamente qué se le envió a LAFISE en ese momento. Dos botones: Exportar PDF y Marcar como ingresado. Si LAFISE rechaza, se puede cambiar el estado a `rechazado`, editar y volver a generar.

---

**Ruta 7 — Contabilidad**

Vista dividida en Ganancias y Gastos.

Ganancias se construye desde `pago_cliente` y `pago_seguro`. Gastos se construye desde `orden_material` (precio_unitario × cantidad_usada, usando el snapshot de costo al momento del uso), `orden_repuesto`, `liquidacion_personal` y `compra_inventario` (con desglose de monto_iva para el cálculo del crédito fiscal frente a la DGI).

Filtros: por período (semana, mes, año, rango personalizado), por tipo de ingreso (particular, lafise, iniser), por tipo de gasto (materiales, repuestos, personal). Muestra total de ganancias, total de gastos y diferencia neta. Exportable a PDF.

El botón Registrar compra está disponible desde esta ruta y desde Inventario. Abre formulario con: proveedor, fecha, monto_subtotal, monto_iva, monto_total, tiene_factura_iva. Al registrar, crea el registro en `compra_inventario` y el movimiento de entrada en `movimiento_inventario`.

---

**Ruta 8 — Ajustes**

Cambio de contraseña del usuario actual. Selector de tema (claro/oscuro). Ajuste de tamaño de fuente con unidades relativas en todos los componentes. Cerrar sesión.

Gestión de usuarios: crear nuevo usuario con email, nombre y rol; desactivar usuario existente (activo = false, bloquea el login sin eliminar el registro); cambiar el rol de un usuario. Sin pantalla de registro pública.

---

---

# SCHEMA v2 — TABLAS CON EXPLICACIÓN

---

**usuario**

```
id (PK)
nombre
email (UNIQUE)
password_hash
rol (enum: administrador, secretaria)
activo (boolean)
fecha_creacion
```

*Para qué existe:* guarda las cuentas de acceso al sistema. Hoy opera con una sola usuaria real (la administradora), pero el campo `rol` y el boolean `activo` permiten escalar a múltiples usuarios y restringir rutas por rol en el futuro sin tocar el schema. Desactivar un usuario lo bloquea sin borrarlo, conservando la trazabilidad de todo lo que hizo.

---

**cliente**

```
id (PK)
nombre
cedula (UNIQUE)
telefono
fecha_nacimiento (nullable)
municipio_residencia
direccion (nullable)
```

*Para qué existe:* almacena la información de contacto e identificación del cliente. La cédula es única y es el campo principal de búsqueda al ingresar una orden. El teléfono es esencial porque la comunicación con el cliente para avisar que el vehículo está listo o para coordinar entregas se hace por esa vía.

---

**vehiculo**

```
id (PK)
id_cliente (FK → cliente.id)
matricula (UNIQUE)
marca
modelo
anio_fabricacion
aseguradora (enum: ninguna, lafise, iniser)
color
chasis (nullable)
motor (nullable)
```

*Para qué existe:* centraliza los datos del vehículo separados del cliente, porque un cliente puede tener varios vehículos y cada uno tendrá su propio historial de órdenes. `aseguradora` aquí es un dato informativo del vehículo; quién paga cada trabajo concreto se define en `orden.tipo_pago`, lo que permite que un vehículo asegurado pueda tener órdenes particulares y viceversa.

---

**proveedor**

```
id (PK)
nombre
contacto (nullable)
emite_factura_iva (boolean)
fijo (boolean)
```

*Para qué existe:* registra a quiénes se les compra material. El campo `emite_factura_iva` es estratégicamente importante: comprar a proveedores que emiten factura con IVA permite compensar ese IVA contra el IVA cobrado al cliente, reduciendo lo que se paga a la DGI. `fijo` indica si el proveedor es recurrente y debe aparecer como opción rápida en los formularios.

---

**inventario**

```
id (PK)
id_proveedor (FK → proveedor.id, nullable)
nombre
precio_unidad
cantidad
stock_minimo
unidad_medida (enum: galon, litro, unidad, kilo, etc.)
fecha_expiracion (nullable)
```

*Para qué existe:* controla los materiales consumibles del taller (pintura, solventes, lijas, etc.). La cantidad no se edita directamente: solo cambia a través de `movimiento_inventario`. `stock_minimo` alimenta la alerta de "cantidad baja" del dashboard. `precio_unidad` sirve de referencia actual, pero el costo real al momento del uso se guarda en `orden_material` como snapshot.

---

**movimiento_inventario**

```
id (PK)
id_inventario (FK → inventario.id)
tipo (enum: entrada_compra, salida_orden, ajuste_manual)
cantidad
fecha
id_usuario (FK → usuario.id)
id_compra (FK → compra_inventario.id, nullable)
id_orden (FK → orden.id, nullable)
nota (nullable)
```

*Para qué existe:* es el historial completo de entradas y salidas del inventario. Toda entrada de mercadería llega vinculada a su compra; toda salida queda vinculada a la orden que consumió el material; los ajustes manuales quedan registrados con el usuario que los hizo y la nota del motivo. Sin esta tabla, la cantidad en inventario sería un número opaco sin trazabilidad.

---

**compra_inventario**

```
id (PK)
id_proveedor (FK → proveedor.id, nullable)
fecha
monto_subtotal
monto_iva
monto_total
tiene_factura_iva (boolean)
```

*Para qué existe:* registra cada compra de materiales como un gasto real del negocio. `monto_iva` separado permite calcular el crédito fiscal acumulado para la compensación ante la DGI: si compraron 3,000 córdobas en pintura con factura IVA, ese IVA se puede descontar del IVA que cobran al cliente. Si `tiene_factura_iva` es false, `monto_iva` va en cero.

---

**repuesto_taller**

```
id (PK)
nombre
marca
modelo
modelo_compatible (nullable)
precio
cantidad
estado (enum: nuevo, usado_bueno, usado_regular, para_reparar)
origen (enum: comprado, proveniente_de_cliente)
fecha_ingreso
```

*Para qué existe:* inventario de piezas físicas reutilizables (bumpers, puertas, corazas, etc.) que el taller acumula de trabajos anteriores o compra directamente. Una pieza disponible en bodega puede cotizarse con mayor margen que una comprada nueva, pero solo si el sistema sabe que existe. `origen` distingue si la pieza fue comprada o provino de un cliente anterior.

---

**personal**

```
id (PK)
nombre
tipo (enum: interno, externo)
rol (enum: pintor, enderezador, mecanico, otro)
telefono (nullable)
fijo (boolean)
```

*Para qué existe:* registra a los trabajadores que intervienen en las órdenes. El taller trabaja con personal externo (pintor y enderezador) que no son empleados fijos sino que cobran por obra. `fijo` indica si deben aparecer como opciones rápidas al asignar personal a una orden.

---

**presupuesto**

```
id (PK)
id_vehiculo (FK → vehiculo.id)
fecha
estado (enum: pendiente, aprobado, rechazado)
subtotal
iva
total
observaciones (nullable)
```

*Para qué existe:* el presupuesto existe antes de la orden. Un cliente puede visitar el taller, recibir su cotización y nunca volver — esa información no puede perderse ni inventarse al crear la orden. Si el presupuesto es aprobado, se crea la orden vinculada con `orden.id_presupuesto`. Permite generar el documento de presupuesto con IVA calculado automáticamente para presentar a la aseguradora o al cliente particular.

---

**presupuesto_detalle**

```
id (PK)
id_presupuesto (FK → presupuesto.id)
tipo_linea (enum: servicio, material, repuesto)
descripcion
cantidad
precio_unitario
aplica_iva (boolean)
```

*Para qué existe:* cada línea del presupuesto. Un presupuesto puede incluir mano de obra, materiales y repuestos como ítems separados con su precio y si aplica IVA. Al aprobarse el presupuesto, estas líneas se copian a `orden_servicio` para alimentar la factura final.

---

**orden**

```
id (PK)
id_vehiculo (FK → vehiculo.id)
id_presupuesto (FK → presupuesto.id, nullable)
id_orden_origen (FK → orden.id, nullable)
tipo (enum: pintura, mecanica, mantenimiento)
fecha_ingreso
fecha_entrega_estimada (nullable)
fecha_entrega_real (nullable)
estado (enum: recibido, en_proceso, listo, entregado, cancelado)
es_garantia (boolean)
fecha_vencimiento_garantia (nullable)
tipo_pago (enum: particular, lafise, iniser)
subtotal (nullable)
iva (nullable)
costo_total (nullable)
monto_seguro (nullable)
monto_cliente (nullable)
numero_tramite (nullable)
numero_orden_seguro (nullable)
numero_factura_fisica (nullable)
obra_externa (boolean)
obra_interna (boolean)
danos_ocultos (boolean)
fecha_creacion
creado_por (FK → usuario.id)
```

*Para qué existe:* es la entidad central del sistema. Toda actividad del taller gira alrededor de la orden: el vehículo que ingresó, qué trabajo se hizo, quién pagó, en qué estado está y cuánto costó. `id_orden_origen` permite vincular órdenes de garantía o de daños ocultos de clientes particulares a su orden original. `subtotal`/`iva`/`costo_total` se calculan desde las líneas de servicio y operaciones, y se guardan como caché al emitir la factura para que los reportes históricos no cambien si algo se edita después.

---

**orden_servicio**

```
id (PK)
id_orden (FK → orden.id)
descripcion
precio
aplica_iva (boolean)
```

*Para qué existe:* cada línea de mano de obra o servicio que se le cobra al cliente. Es importante distinguirla de `orden_personal.monto_acordado`, que es lo que el taller le paga al trabajador — la diferencia entre ambas es el margen del taller. Sin esta tabla no se puede generar una proforma, un presupuesto con IVA ni una factura final desglosada.

---

**repuesto_cliente**

```
id (PK)
id_orden (FK → orden.id)
nombre
marca
modelo
cantidad
estado (enum: en_taller, devuelto, transferido_a_taller)
descripcion (nullable)
```

*Para qué existe:* piezas que el cliente trae al taller para que sean instaladas o trabajadas. Deben quedar registradas para evitar que se pierdan o confundan. El vehículo se conoce a través de la orden, eliminando la doble FK que existía en v1. Cuando una pieza se transfiere al inventario del taller se ejecuta una transacción atómica que crea el registro en `repuesto_taller`.

---

**orden_material**

```
id (PK)
id_orden (FK → orden.id)
id_material (FK → inventario.id)
cantidad_usada
precio_unitario
fecha_registro
registrado_por (FK → usuario.id)
```

*Para qué existe:* registra qué materiales del inventario se consumieron en cada orden. `precio_unitario` es un snapshot del costo en el momento del uso, garantizando que los reportes históricos no cambien si el precio del material sube después. Al guardar, se genera automáticamente el movimiento de salida en `movimiento_inventario`.

---

**orden_repuesto**

```
id (PK)
id_orden (FK → orden.id)
id_repuesto (FK → repuesto_taller.id)
cantidad_usada
precio_unitario
fecha_registro
registrado_por (FK → usuario.id)
```

*Para qué existe:* mismo propósito que `orden_material` pero para las piezas físicas del inventario de repuestos del taller. Permite saber exactamente qué pieza se usó en qué auto, cuándo y a qué precio se registró.

---

**orden_personal**

```
id (PK)
id_orden (FK → orden.id)
id_personal (FK → personal.id)
monto_acordado
fecha_registro
```

*Para qué existe:* vincula a un trabajador con una orden y registra cuánto se acordó pagarle por ese trabajo específico. Es la base de cálculo para las liquidaciones. El estado de pago se deriva exclusivamente de la tabla de liquidaciones, no de ningún campo propio, garantizando una sola fuente de verdad.

---

**orden_media**

```
id (PK)
id_orden (FK → orden.id)
url
tipo (enum: foto, video, pdf, documento)
descripcion (nullable)
fecha_subida
categoria (enum: recepcion_vehiculo, dano_oculto, trabajo_terminado,
           documento_seguro, factura, recibo, otro)
subido_por (FK → usuario.id)
```

*Para qué existe:* almacena todos los archivos adjuntos de una orden. El video del estado del vehículo al ingreso, las fotos de daños ocultos para la aseguradora, los PDFs de órdenes de compra, los recibos generados, la factura final. `categoria` permite filtrar por tipo de documento sin abrir cada archivo. `subido_por` deja constancia de quién adjuntó cada cosa.

---

**orden_dano_oculto**

```
id (PK)
id_orden (FK → orden.id)
descripcion
costo_adicional
aplica_seguro (boolean)
monto_cubierto_seguro (nullable)
monto_extra_cliente (nullable)
estado_aprobacion (enum: pendiente, aprobado, rechazado)
fecha_reporte
fecha_respuesta (nullable)
```

*Para qué existe:* cuando al desmontar un vehículo aparecen daños que no eran visibles inicialmente, se registran aquí con su costo adicional y el estado de aprobación de la aseguradora. Aplica solo para órdenes de lafise o iniser. Para clientes particulares, un daño oculto se tramita como una orden nueva vinculada con `id_orden_origen`. Un daño aprobado puede generar un pago adicional de la aseguradora registrado en `pago_seguro`.

---

**pago_cliente**

```
id (PK)
id_orden (FK → orden.id)
monto
fecha
tipo (enum: adelanto, abono, saldo)
metodo (enum: efectivo, transferencia, otro)
numero_recibo
registrado_por (FK → usuario.id)
```

*Para qué existe:* registra cada pago recibido del cliente. El cliente particular paga un anticipo del 50% al dejar el vehículo y el saldo al retirarlo — ambos van aquí vinculados a la misma orden. `numero_recibo` guarda el correlativo del talonario físico para cuadrar con los documentos en papel. `registrado_por` deja trazabilidad de quién registró el pago.

---

**pago_seguro**

```
id (PK)
id_orden (FK → orden.id)
monto
fecha_esperada (nullable)
fecha_recibido (nullable)
estado (enum: pendiente, recibido)
referencia_bancaria (nullable)
concepto (enum: pago_principal, dano_oculto, otro)
```

*Para qué existe:* registra los pagos que llegan de la aseguradora, que funcionan diferente a los pagos de clientes particulares: se espera un depósito, no un pago en efectivo en ventanilla. Es una relación 1:N porque una orden puede recibir el pago principal y pagos adicionales por daños ocultos aprobados. `concepto` distingue a cuál corresponde cada depósito.

---

**linker_lafise**

```
id (PK)
id_orden (FK → orden.id)
numero_reclamo
numero_orden_compra
chasis
motor
placa
nombre_cliente
estado_ingreso (enum: pendiente, ingresado, confirmado, rechazado)
fecha_ingreso_linker (nullable)
observaciones (nullable)
```

*Para qué existe:* LAFISE requiere que el taller ingrese los datos de cada trabajo en su plataforma web Linker para gestionar el cobro. Esta tabla guarda un snapshot exacto de los datos que se enviaron a LAFISE, independiente de si después se edita algo en la orden. `estado_ingreso` permite dar seguimiento a si la información fue ingresada, confirmada o rechazada por la plataforma.

---

**liquidacion_personal**

```
id (PK)
id_personal (FK → personal.id)
fecha
monto_total
pagado (boolean)
fecha_pago (nullable)
```

*Para qué existe:* agrupa el pago acumulado a un trabajador al final de un período. El pintor y el enderezador trabajan por obra y se les liquida sumando todos los `monto_acordado` de las órdenes en que participaron. Esta tabla es el registro de que esa liquidación se hizo y si ya fue pagada.

---

**liquidacion_detalle**

```
id (PK)
id_liquidacion (FK → liquidacion_personal.id)
id_orden_personal (FK → orden_personal.id)
```

*Para qué existe:* es el desglose de qué trabajos específicos están incluidos en una liquidación. Un `orden_personal` que aparece en el detalle de una liquidación pagada queda automáticamente marcado como liquidado — sin necesidad de un campo `pagado` propio. Esto garantiza que no haya dos fuentes de verdad sobre el estado de pago de un trabajo.

---

**auditoria**

```
id (PK)
id_usuario (FK → usuario.id)
tabla
id_registro
accion (enum: crear, editar, eliminar, cambio_estado)
fecha_hora
detalle (nullable)
```

*Para qué existe:* registra quién hizo qué y cuándo en cada operación relevante del sistema. Creación de órdenes, pagos, movimientos de inventario, cambios de estado, liquidaciones — todo queda firmado con usuario y timestamp. Es el requisito de auditoría del contexto del proyecto y también la protección del taller ante cualquier reclamo de "eso no se hizo así".

cliente              1 ──── N   vehiculo
vehiculo             1 ──── N   presupuesto
vehiculo             1 ──── N   orden
presupuesto          1 ──── N   presupuesto_detalle
presupuesto          0|1 ──── 1 orden              (presupuesto aprobado → orden)
orden                1 ──── N   orden_servicio
orden                1 ──── N   repuesto_cliente
orden                1 ──── N   orden_material
orden                1 ──── N   orden_repuesto
orden                1 ──── N   orden_personal
orden                1 ──── N   orden_media
orden                1 ──── N   orden_dano_oculto
orden                1 ──── N   pago_cliente
orden                1 ──── N   pago_seguro         (solo lafise/iniser)
orden                1 ──── 1   linker_lafise       (solo lafise)
orden              0|1 ──── N   orden               (garantía o daño oculto particular → orden origen)
proveedor            1 ──── N   inventario
proveedor            1 ──── N   compra_inventario
inventario           1 ──── N   movimiento_inventario
compra_inventario    1 ──── N   movimiento_inventario
personal             1 ──── N   orden_personal
personal             1 ──── N   liquidacion_personal
liquidacion_personal 1 ──── N   liquidacion_detalle
orden_personal       1 ──── N   liquidacion_detalle
usuario              1 ──── N   auditoria
usuario              1 ──── N   movimiento_inventario

---

