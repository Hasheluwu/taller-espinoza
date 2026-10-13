from pathlib import Path

root = Path(__file__).parent
source = (root / 'build_document.py').read_text(encoding='utf-8')
source = source.replace("OUT = ROOT / 'Documentacion_actualizada_Taller_Espinoza.docx'", "OUT = ROOT / 'Proyecto_Taller_Espinoza_Documentacion_Integral.docx'")
source = source.replace('Avance funcional arquitectura y modelo de base de datos', 'Fundamentos funcionamiento y aplicación del modelo relacional')
source = source.replace("p('Esta documentación actualiza el planteamiento del 7 de septiembre de 2026 y explica el funcionamiento desarrollado, las reglas de negocio y la estructura de los datos. El avance dispone de pruebas automatizadas, pero la instalación del usuario presenta una incidencia de rutas no encontradas que impide considerar cerrada su validación operativa.')", "p('El sistema responde a la necesidad de mantener conectados los procesos comerciales, técnicos y administrativos de un taller de enderezado, pintura y mecánica. Este documento presenta el problema, la justificación, los objetivos, el funcionamiento de los módulos y la aplicación del modelo relacional. También establece el alcance del avance y las verificaciones pendientes para su operación completa.')")
source = source.replace('6 Modelos de datos utilizados', '6 Aplicación del modelo relacional')
source = source.replace('11 Pendientes y referencias del proyecto', '11 Mejoras previstas y conclusiones')
start = source.index("page('1 Contexto objetivos y alcance')")
end = source.index("page('2 Arquitectura y tecnologías')")
source = source[:start] + '''page('1 Contexto objetivos y alcance')
h('Antecedentes y problema')
p('La operación de un taller combina recepción de clientes y vehículos, presupuestos, reparaciones, inventario, coordinación con aseguradoras y pagos al personal. Cuando la información se distribuye entre papeles, hojas de cálculo y mensajes, resulta difícil reconstruir qué trabajo se realizó, qué recursos se consumieron y qué cantidades siguen pendientes de pago.')
p('Los principales problemas son la falta de trazabilidad de materiales y repuestos, la pérdida de referencias históricas de precios, la confusión entre abonos y saldos, y la posibilidad de registrar un trabajo como pagado en una fuente y pendiente en otra. Los daños ocultos y las diferencias con aseguradoras requieren además conservar el contexto de cada reparación y distinguir los importes previstos de los recibidos.')
h('Justificación')
p('Centralizar los registros permite relacionar cada consumo y cada pago con su orden de trabajo. Conservar precios históricos facilita interpretar reparaciones anteriores, mientras que separar los saldos del cliente y del seguro mejora el seguimiento de cobros. El registro de trabajadores y liquidaciones ofrece una referencia común para conocer los compromisos de mano de obra y los pagos realizados.')
p('Desde el punto de vista técnico y académico, el proyecto permite aplicar el modelo relacional a un caso real mediante tablas, claves, consultas y transacciones. La separación entre interfaz, servidor y base de datos facilita el mantenimiento. Los permisos y la auditoría de acciones específicas ayudan a controlar cambios importantes y a identificar quién los registra.')
h('Objetivo general')
p('Desarrollar un sistema web para administrar el ciclo de atención del Taller Pedro Espinoza, relacionando clientes, vehículos, órdenes, recursos utilizados, cobros y pagos al personal mediante información consistente y consultable.')
h('Objetivos específicos')
bullets(['Organizar clientes, vehículos, presupuestos y órdenes, conservando el historial de reparaciones.', 'Controlar existencias, consumos y recursos asignados a cada trabajo.', 'Acumular abonos, separar obligaciones de cliente y aseguradora y registrar liquidaciones del personal.', 'Facilitar el seguimiento mediante citas, fechas de entrega, fotos y costos por orden.', 'Aplicar autenticación, permisos y validaciones para reducir registros inconsistentes.'])
h('Alcance')
p('La aplicación está dirigida a administración y secretaría. El trabajador técnico se registra como personal asignado, sin que ello cree una cuenta de acceso. El sistema registra información y pagos realizados; no ejecuta transferencias bancarias. Las liquidaciones corresponden a trabajos realizados y la ganancia por orden es una estimación según los costos registrados.')

''' + source[end:]
start = source.index("page('6 Aplicación del modelo relacional')")
end = source.index("page('7 Organización del esquema de datos')")
source = source[:start] + '''page('6 Aplicación del modelo relacional')
h('Modelo utilizado')
p('El proyecto utiliza el modelo de base de datos relacional, implementado en MySQL. La información se organiza en tablas: cada fila representa un registro y cada columna describe una característica. Por ejemplo, cliente contiene los datos de las personas atendidas y vehiculo contiene la matrícula, marca, modelo y referencia a su propietario.')
h('Cómo se relaciona la información')
p('Cada tabla principal tiene una clave primaria que identifica sus registros, generalmente el campo id. Las claves foráneas guardan la referencia a un registro de otra tabla. Así, vehiculo.id_cliente enlaza el vehículo con su cliente, y orden.id_vehiculo enlaza una reparación con el vehículo atendido. No es necesario volver a escribir todos los datos del cliente en cada orden.')
p('El servidor utiliza consultas SQL para recuperar y combinar estos registros. Las consultas con JOIN permiten mostrar en una misma pantalla información de varias tablas; por ejemplo, el número de orden junto con la matrícula del vehículo y el nombre del cliente. Las restricciones de claves foráneas protegen las relaciones al exigir que los registros referenciados existan.')
h('Dónde se aplica en el sistema')
table(['Proceso','Tablas relacionadas','Aplicación concreta'],[
('Atención y reparación','cliente, vehiculo y orden','Consultar las reparaciones de un vehículo y su propietario.'),
('Presupuestos','presupuesto y presupuesto_detalle','Agrupar las líneas de una estimación.'),
('Consumo de materiales','orden, inventario y orden_material','Registrar qué producto se utilizó y en qué cantidad.'),
('Cobros','orden, pago_cliente y pago_seguro','Acumular abonos y calcular saldos separados.'),
('Personal y liquidaciones','personal, orden_personal, liquidacion_personal y liquidacion_detalle','Relacionar trabajadores, acuerdos y trabajos incluidos en cada liquidación.'),
('Seguimiento','vehiculo, cita, orden, foto_orden y costo_orden','Vincular citas con vehículos, y fotos y costos con órdenes.')],[1.25,2.65,2.7])
h('Ejemplo integrado')
p('Al registrar un cliente se obtiene su identificador. Su vehículo guarda ese identificador como referencia y la orden guarda el identificador del vehículo. Cuando se consume líquido de frenos, orden_material enlaza la orden con el producto de inventario. Los abonos se vinculan a la misma orden. Esta cadena permite consultar la reparación completa sin mantener listas independientes de clientes, materiales y pagos.')

''' + source[end:]
source = source.replace("p('presupuesto_detalle y liquidacion_detalle dependen del registro principal para su significado de negocio, aunque ambas poseen una clave primaria propia. Por ello, llamarlas entidades débiles en sentido estricto requiere precisar la notación conceptual; en el esquema físico se describen mejor como tablas de detalle dependientes.')", "p('Las tablas de detalle conservan información que pertenece a un registro principal. presupuesto_detalle almacena las líneas de un presupuesto; liquidacion_detalle identifica las asignaciones incluidas en una liquidación. Cada detalle tiene su identificador y una clave foránea hacia su cabecera, de modo que puede consultarse tanto el conjunto como cada registro individual.')")
start = source.index("h('Cambios respecto al documento inicial')")
end = source.index("h('Valoración del avance')", start)
source = source[:start] + '''h('Evolución funcional')
p('El crecimiento del sistema debe concentrarse primero en estabilizar los recorridos existentes. Un registro completo debe permitir pasar del cliente al vehículo, de este a la orden y de la orden a sus recursos, cobros y costos. Las funciones futuras deben conservar esas relaciones y definir cómo se corrigen errores sin perder la trazabilidad de los movimientos.')
p('La integración con aseguradoras y el almacenamiento externo de archivos son ampliaciones posibles. Su incorporación requiere definir permisos, referencias y procedimientos de confirmación. En el alcance actual, los cobros del seguro se registran internamente y las fotografías se almacenan en MySQL.')
h('Beneficios esperados')
p('El historial por vehículo facilita revisar trabajos anteriores; los movimientos de inventario permiten conocer el uso de materiales; y los saldos separados ayudan a identificar a quién corresponde cada deuda. Las liquidaciones relacionan pagos con trabajos concretos, mientras que la agenda y las fotos complementan el seguimiento de recepción, reparación y entrega.')
p('Estos beneficios dependen de registrar datos completos y de mantener procedimientos consistentes. La calidad del sistema también requiere revisar costos, asignar correctamente los responsables, documentar las diferencias de cobro y comprobar los respaldos. La aplicación apoya esas tareas, pero no reemplaza la revisión administrativa del taller.')
''' + source[end:]
source = source.replace("h('Valoración del avance')", "h('Conclusiones')")
source = source.replace("El esquema original no declara", "El esquema no declara").replace("el esquema original no declara", "el esquema no declara")
source = source.replace("En la revisión anterior también se completaron", "Durante la verificación del desarrollo también se completaron")
(root / 'build_integral.py').write_text(source, encoding='utf-8')
exec(compile(source, str(root / 'build_integral.py'), 'exec'))
