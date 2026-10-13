from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).parent
OUT = ROOT / 'Proyecto_Taller_Espinoza_Documentacion_Integral.docx'
doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.27); sec.page_height = Inches(11.69)
sec.top_margin = Inches(.72); sec.bottom_margin = Inches(.72)
sec.left_margin = Inches(.8); sec.right_margin = Inches(.8)
sec.footer_distance = Inches(.32)
for name, size in [('Normal',10.5),('Title',25),('Subtitle',13),('Heading 1',17),('Heading 2',12)]:
    s = doc.styles[name]; s.font.name = 'Calibri'; s.font.size = Pt(size); s.font.color.rgb = RGBColor(0,0,0)
    s.paragraph_format.space_after = Pt(7)
    s.paragraph_format.line_spacing = 1.1
    if name.startswith('Heading'): s.paragraph_format.space_before = Pt(10)
doc.styles['Normal'].paragraph_format.widow_control = True
doc.core_properties.title = 'Documentación del sistema de gestión del Taller Pedro Espinoza'
doc.core_properties.subject = 'Fundamentos funcionamiento y aplicación del modelo relacional'
doc.core_properties.author = 'Equipo del proyecto Taller Pedro Espinoza'
doc.core_properties.keywords = 'taller, MySQL, modelo relacional, inventario, órdenes, pagos'
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
r=footer.add_run('Página ');r.font.size=Pt(9)
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)

def p(text, style=None):
    return doc.add_paragraph(text, style)
def h(text): doc.add_heading(text,2)
def page(title):
    doc.add_page_break();doc.add_heading(title,1)
def bullets(items):
    for text in items:p(text,'List Bullet')
def table(headers, rows, widths):
    t=doc.add_table(rows=1, cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    for col,w in zip(t.columns,widths):col.width=Inches(w)
    for c,text in zip(t.rows[0].cells,headers):c.text=text
    trPr=t.rows[0]._tr.get_or_add_trPr();repeat=OxmlElement('w:tblHeader');trPr.append(repeat)
    for row in rows:
        for c,text in zip(t.add_row().cells,row):c.text=str(text)
    for i,row in enumerate(t.rows):
        for j,c in enumerate(row.cells):
            c.width=Inches(widths[j]);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            pr=c._tc.get_or_add_tcPr();sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'263746' if i==0 else ('F1F4F6' if i%2 else 'FFFFFF'));pr.append(sh)
            borders=OxmlElement('w:tcBorders')
            for edge in ['top','left','bottom','right']:
                e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
            pr.append(borders)
            margins=OxmlElement('w:tcMar')
            for edge in ['top','left','bottom','right']:
                e=OxmlElement('w:'+edge);e.set(qn('w:w'),'85');e.set(qn('w:type'),'dxa');margins.append(e)
            pr.append(margins)
            for para in c.paragraphs:
                para.paragraph_format.space_after=Pt(3);para.paragraph_format.space_before=Pt(2);para.paragraph_format.line_spacing=1.04
                for r in para.runs:r.font.size=Pt(9.5);r.font.bold=i==0;r.font.color.rgb=RGBColor.from_string('FFFFFF' if i==0 else '000000')
    p('')
    return t

doc.add_heading('Documentación del sistema de gestión del Taller Pedro Espinoza',0)
p('Fundamentos funcionamiento y aplicación del modelo relacional','Subtitle')
p('Actualización del 11 de octubre de 2026')
h('Equipo del proyecto')
p('Hashel Ignacio López Arguello\nJosé Neftalí Tapia Álvarez\nMaximiliano Guido Torres')
p('Grupo 3T3-COM-S\nDocente Ing. Euclides')
h('Presentación')
p('El proyecto organiza la atención de clientes y vehículos, las reparaciones, el consumo de materiales y el control de pagos del taller. La implementación incorpora una interfaz web, un servidor de servicios y una base de datos MySQL de modelo relacional. Las ampliaciones recientes incluyen historial por vehículo, agenda, fotos, costos por orden y liquidaciones por trabajos realizados.')
p('El sistema responde a la necesidad de mantener conectados los procesos comerciales, técnicos y administrativos de un taller de enderezado, pintura y mecánica. Este documento presenta el problema, la justificación, los objetivos, el funcionamiento de los módulos y la aplicación del modelo relacional. También establece el alcance del avance y las verificaciones pendientes para su operación completa.')
h('Contenido')
for line in ['1 Contexto objetivos y alcance','2 Arquitectura y tecnologías','3 Operación del taller e inventario','4 Pagos y liquidaciones','5 Historial agenda fotos y costos','6 Aplicación del modelo relacional','7 Organización del esquema de datos','8 Relaciones y cardinalidades','9 Integridad transacciones y seguridad','10 Verificación e instalación','11 Mejoras previstas y conclusiones']:p(line)

page('1 Contexto objetivos y alcance')
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

page('2 Arquitectura y tecnologías')
p('La aplicación sigue una organización cliente servidor. El navegador presenta formularios y consultas; el backend valida las solicitudes y ejecuta reglas de negocio; MySQL conserva los registros. La separación en capas permite modificar la presentación sin trasladar al navegador la responsabilidad de autorizar o validar los movimientos.')
table(['Capa','Tecnología','Responsabilidad'],[
('Presentación','React y React Router','Pantallas, navegación, formularios y estados de carga.'),
('Desarrollo web','Vite y CSS','Servidor de desarrollo, compilación y presentación visual.'),
('Servicios','Node.js y Express','Rutas HTTP, reglas de negocio y respuestas JSON.'),
('Persistencia','MySQL y mysql2/promise','Consultas SQL parametrizadas, relaciones y transacciones.'),
('Autenticación','bcrypt y JWT','Verificación de contraseñas y sesiones con vencimiento.'),
('Calidad','node:test y ESLint','Pruebas automatizadas y revisión estática del frontend.')],[1.1,1.8,3.7])
h('Organización del código')
p('En frontend/src/pages se encuentran las pantallas. components reúne piezas reutilizables como el resumen de pagos y el formulario de consumo. lib contiene el acceso común a la API y utilidades; hooks concentra comportamiento reutilizable de carga y avisos.')
p('En backend/src/routes se agrupan las rutas por módulo. services contiene validación, cálculo de saldos y preparación de tablas. middleware comprueba autenticación y valores numéricos; handlers contiene acciones compartidas, como el cambio de estado de una orden.')
h('Recorrido de una solicitud')
p('Cuando se registra un consumo, React envía los identificadores y la cantidad a Express. El servidor verifica la sesión, el estado de la orden y el stock; realiza las escrituras en una transacción y devuelve el resultado. La interfaz actualiza la vista con la respuesta del servidor.')
h('Diseño de la interfaz')
p('Se trabajó una presentación oscura con acentos naranjas, navegación lateral adaptable, jerarquía visual, formularios y avisos de error o éxito. También se incorporaron estados de carga y transiciones visuales. El diseño facilita reconocer acciones y resultados, aunque varias pantallas todavía son extensas y conviene seguir separándolas en componentes menores.')

page('3 Operación del taller e inventario')
h('Clientes vehículos y presupuestos')
p('El cliente se identifica mediante sus datos de contacto y cédula. Sus vehículos se registran con matrícula y características. Un vehículo puede acumular presupuestos y órdenes a lo largo del tiempo, lo que permite consultar reparaciones anteriores sin crear una ficha distinta para cada visita.')
p('Los presupuestos contienen líneas de servicios, materiales o repuestos. Una orden puede vincularse a un presupuesto del mismo vehículo, pero aprobarlo no crea automáticamente una orden ni copia sus líneas al cobro. El total operativo procede de los cargos registrados en las operaciones de la orden.')
h('Órdenes y operaciones')
p('Los estados utilizados son recibido, en_proceso, listo, entregado y cancelado. Las acciones rápidas permiten iniciar trabajo, marcar listo y registrar entrega. El cambio de estado se guarda junto con su auditoría. La entrega del vehículo y la liquidación del saldo son hechos separados.')
p('En Operaciones se registran servicios, materiales, repuestos, personal y reportes de daños ocultos. Las modificaciones de líneas se restringen a órdenes recibidas o en proceso. La base incluye un vínculo con una orden de origen para reparaciones derivadas; el circuito completo de aprobación de daños ocultos no debe considerarse automatizado.')
h('Inventario utilizable')
p('La pantalla de inventario ofrece el botón Usar. Se elige una orden editable, un trabajador y la cantidad expresada en la unidad del producto. Por ejemplo, consumir 1 litro de un líquido con 2 litros disponibles deja 1 litro en stock. No se permite consumir más de lo disponible.')
p('El consumo genera una línea en orden_material y una salida en movimiento_inventario. consumo_responsable relaciona la línea con el trabajador y una nota. Se conserva el usuario que registró la operación. El consumo desde Inventario no añade por sí mismo otro pago al trabajador.')
p('En Operaciones se puede registrar material sin asignar personal; si también se indica un monto de mano de obra, ambas escrituras se realizan juntas. Existe además una acción para guardar solo mano de obra. Debe evitarse registrar de nuevo un monto que ya fue acordado para ese trabajo.')
h('Compras ajustes y repuestos')
p('Las compras incrementan las existencias y el servidor calcula sus totales a partir de los artículos. Los ajustes manuales requieren administración y no permiten stock negativo. La eliminación permitida de un material devuelve stock mediante un movimiento de reversión. Los repuestos del taller y los aportados por el cliente se mantienen en registros separados.')

page('4 Pagos y liquidaciones')
h('Abonos acumulados')
p('Adelanto, abono y saldo describen el tipo de registro, pero todos los pagos del cliente disminuyen la misma deuda. El cálculo se realiza en centavos para evitar diferencias de redondeo. Cuando el pagador completa su parte, se oculta el formulario de cobro; el historial y los recibos permanecen disponibles.')
table(['Registro','Abono','Acumulado','Saldo'],[('Total de la orden','—','C$ 0.00','C$ 50,000.00'),('Primer abono','C$ 5,000.00','C$ 5,000.00','C$ 45,000.00'),('Segundo abono','C$ 3,000.00','C$ 8,000.00','C$ 42,000.00'),('Pago final','C$ 42,000.00','C$ 50,000.00','C$ 0.00')],[1.7,1.6,1.7,1.6])
h('Cliente y aseguradora')
p('En una orden asegurada se definen por separado el monto del cliente y el monto del seguro. Ambos deben sumar el total de la reparación. Un cobro pendiente del seguro reserva su importe, pero solo cuenta como recibido cuando se confirma. El estado Pagado requiere cubrir las dos partes; un exceso de un pagador no cancela automáticamente la deuda del otro.')
p('Ejemplo: si la reparación vale C$ 20,000 y corresponden C$ 9,000 al cliente y C$ 11,000 al seguro, recibir C$ 12,000 del seguro produce C$ 1,000 de excedente. Administración puede confirmar ese importe con justificación; el excedente se muestra por separado y no aumenta la venta ni la ganancia. Si el dato pendiente estaba mal escrito, puede corregirse con un motivo y auditoría. No se altera automáticamente un pago recibido.')
h('Liquidación de trabajos del personal')
p('Administración selecciona un trabajador y sus asignaciones en órdenes listas o entregadas. El servidor suma los montos acordados y prepara una liquidación pendiente. Posteriormente se registra el pago realizado, indicando fecha y referencia. El sistema conserva el detalle de los trabajos incluidos.')
p('Una asignación no puede incluirse nuevamente en otra liquidación por este flujo. Repetir la confirmación de una liquidación pagada no crea un segundo pago. Pertenecer a un detalle de liquidación significa que el trabajo está incluido en ella; el pago efectivo se determina consultando también liquidacion_personal.pagado.')
p('No están incluidos la devolución o aplicación de excedentes a otras órdenes, ni la anulación o corrección de una liquidación ya preparada. Estos procedimientos necesitan un flujo de conciliación adicional.')

page('5 Historial agenda fotos y costos')
h('Historial por vehículo')
p('La consulta por matrícula reúne las órdenes del vehículo con fechas, tipo de reparación, estado, servicios y materiales registrados. Los enlaces permiten abrir operaciones, pagos y el expediente. El historial se obtiene de las relaciones existentes, sin duplicar las reparaciones en una tabla independiente.')
h('Agenda y fechas de entrega')
p('La agenda permite programar citas para vehículos registrados, indicando inicio, fin y motivo. Las citas pueden completarse o cancelarse. Se rechazan horarios inválidos y superposiciones para el mismo vehículo. El avance no reserva cupos por mecánico ni envía recordatorios automáticos.')
p('La fecha de entrega estimada se modifica en el expediente de una orden abierta. La agenda muestra las entregas previstas dentro del período consultado. La fecha estimada no equivale a la entrega real ni cambia por sí sola el estado de reparación.')
h('Fotografías de recepción y entrega')
p('El expediente permite adjuntar fotos JPEG, PNG o WebP de hasta 3 MB cada una, con etapa y descripción. La ruta de lectura requiere autenticación. Los archivos se guardan como contenido binario MEDIUMBLOB en foto_orden; por ello, el respaldo de MySQL debe incluir esas tablas y su contenido.')
p('El esquema inicial contiene orden_media como estructura general de adjuntos. La implementación actual de fotos utiliza foto_orden. No debe atribuirse a orden_media un flujo de carga de documentos completo ni presentarse Cloudflare R2 como un servicio actualmente integrado.')
h('Costos y ganancia estimada')
p('Administración registra los costos reales de materiales, repuestos y otros gastos de la orden. La mano de obra se obtiene de los montos acordados en orden_personal. Los precios cobrados por materiales no se toman automáticamente como su costo real de adquisición.')
p('La ganancia estimada corresponde a la venta sin IVA menos los costos registrados y la mano de obra acordada. Por ejemplo, una venta sin IVA de C$ 20,000, con C$ 5,000 en materiales, repuestos y otros gastos y C$ 5,000 de mano de obra, presenta una ganancia estimada de C$ 10,000.')
p('Mientras no se registren los costos, la pantalla indica que la revisión está pendiente. La cifra no equivale al efectivo cobrado ni incluye gastos generales que no se hayan registrado. Si cambian los consumos o los acuerdos de trabajo, también debe revisarse la información de costos.')

page('6 Aplicación del modelo relacional')
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

page('7 Organización del esquema de datos')
p('El archivo taller_espinoza.sql define 25 tablas. El código de migración añade cinco estructuras: sesion_usuario, cita, foto_orden, costo_orden y consumo_responsable. En conjunto, el diseño revisado contempla 30 tablas; esto describe el esquema disponible, no certifica que todas las migraciones se hayan aplicado a la instalación activa.')
table(['Área','Tablas del esquema','Finalidad'],[
('Acceso','usuario; sesion_usuario','Usuarios, roles y sesiones revocables.'),
('Clientes','cliente; vehiculo','Propietarios y vehículos atendidos.'),
('Compras e inventario','proveedor; inventario; compra_inventario; movimiento_inventario','Catálogo, existencias y movimientos.'),
('Repuestos','repuesto_taller; repuesto_cliente','Piezas propias y aportadas por el cliente.'),
('Presupuestos','presupuesto; presupuesto_detalle','Estimación y líneas de trabajo.'),
('Órdenes','orden; orden_servicio; orden_dano_oculto','Reparación, servicios y daños reportados.'),
('Recursos usados','orden_material; orden_repuesto; consumo_responsable','Cantidades, precios históricos y trabajador responsable.'),
('Personal','personal; orden_personal; liquidacion_personal; liquidacion_detalle','Acuerdos de trabajo y liquidaciones.'),
('Cobros','pago_cliente; pago_seguro','Abonos y cobros de aseguradoras.'),
('Seguimiento','cita; foto_orden; costo_orden','Agenda, evidencia fotográfica y costos.'),
('Soporte y evolución','orden_media; linker_lafise; auditoria','Adjuntos previstos, datos para integración futura y registro de acciones.')],[1.15,3.1,2.35])
h('Estructuras previstas y funciones disponibles')
p('La existencia de una tabla no garantiza una pantalla o integración terminada. linker_lafise conserva una estructura prevista para datos de aseguradora, pero no acredita conexión automática con LAFISE. orden_media tampoco reemplaza el flujo de foto_orden que utiliza el expediente actual.')
p('Las ampliaciones se preparan con CREATE TABLE IF NOT EXISTS. Este mecanismo crea tablas ausentes, pero no es un sistema completo de evolución de columnas y versiones; si cambia una estructura ya existente, será necesario definir una migración específica.')

page('8 Relaciones y cardinalidades')
p('Las claves primarias identifican registros y las claves foráneas vinculan las entidades. La tabla siguiente resume las principales relaciones. La notación 1 a N indica que un registro principal puede estar asociado con varios registros dependientes; no obliga a que ya exista uno.')
table(['Relación','Cardinalidad','Implementación'],[
('Cliente y vehículo','1 a N','vehiculo.id_cliente'),
('Vehículo y orden','1 a N','orden.id_vehiculo'),
('Vehículo y presupuesto','1 a N','presupuesto.id_vehiculo'),
('Presupuesto y detalle','1 a N','presupuesto_detalle.id_presupuesto'),
('Presupuesto y orden','1 a N opcional','orden.id_presupuesto admite NULL y no es UNIQUE.'),
('Orden y orden derivada','1 a N opcional','orden.id_orden_origen referencia orden.id.'),
('Orden y material de inventario','N a M mediante líneas','orden_material enlaza orden e inventario.'),
('Orden y trabajador','N a M mediante asignaciones','orden_personal añade monto_acordado.'),
('Orden y pago','1 a N por tipo de pagador','pago_cliente y pago_seguro contienen id_orden.'),
('Liquidación y detalle','1 a N','liquidacion_detalle enlaza cada asignación incluida.'),
('Orden y costos revisados','1 a 0 o 1','costo_orden.id_orden es PK y FK.'),
('Consumo y responsable','1 a 0 o 1','consumo_responsable.id_material_orden es PK y FK.')],[1.8,1.5,3.3])
h('Relaciones asociativas y recursivas')
p('orden_material y orden_personal resuelven relaciones de muchos a muchos y añaden información del vínculo, como cantidad usada o monto acordado. No hay una restricción única sobre cada pareja de identificadores; por tanto, puede haber varias líneas para el mismo recurso o trabajador dentro de una orden.')
p('La relación recursiva de orden permite enlazar una reparación derivada con una orden previa. Cada orden derivada puede señalar una sola orden de origen; una orden original puede tener varias derivadas.')

page('9 Integridad transacciones y seguridad')
h('Organización relacional y normalización')
p('El esquema separa clientes, vehículos, órdenes, productos y pagos, evitando repetir sus datos completos en cada movimiento. Los detalles y tablas asociativas permiten registrar cantidades variables de líneas. Esta estructura favorece la normalización, pero no constituye por sí sola una demostración formal de tercera forma normal: sería necesario revisar dependencias funcionales y restricciones de cada tabla.')
p('Las tablas de detalle conservan información que pertenece a un registro principal. presupuesto_detalle almacena las líneas de un presupuesto; liquidacion_detalle identifica las asignaciones incluidas en una liquidación. Cada detalle tiene su identificador y una clave foránea hacia su cabecera, de modo que puede consultarse tanto el conjunto como cada registro individual.')
h('Datos históricos y valores derivados')
p('El precio_unitario guardado en orden_material y orden_repuesto es una copia histórica tomada al registrar el uso. Se almacena precisamente para no depender del precio actual del catálogo; no es un atributo derivado calculado en cada consulta. En cambio, el saldo y el estado Pagado se calculan a partir de obligaciones y pagos.')
p('La preparación y el pago de una liquidación también son estados distintos. El registro en liquidacion_detalle indica inclusión, y la cabecera liquidacion_personal determina si se pagó. El control de no duplicar una asignación se aplica mediante lógica transaccional; el esquema no declara una restricción UNIQUE sobre id_orden_personal.')
h('Atomicidad y concurrencia')
p('Las transacciones agrupan cambios relacionados: consumo y descuento de stock, registro de pagos y auditoría, o preparación de liquidaciones. Si falla una operación del grupo, se solicita rollback. Los bloqueos SELECT FOR UPDATE serializan accesos a registros críticos para evitar que dos solicitudes utilicen simultáneamente el mismo saldo disponible.')
p('Los importes monetarios se almacenan en columnas DECIMAL y el servicio de saldos calcula en centavos. Se rechazan valores inválidos, negativos, pagos de cero y fracciones de centavo. Las garantías reales de concurrencia deben comprobarse también con el motor MySQL y su configuración de tablas transaccionales.')
h('Acceso y registro de acciones')
p('Las contraseñas se verifican con bcrypt. El inicio de sesión genera un JWT de ocho horas con identificador asociado a sesion_usuario. El servidor verifica la sesión y el usuario activo; cerrar sesión elimina la sesión registrada. Administración tiene permisos adicionales para ajustes, costos y liquidaciones. La auditoría cubre acciones específicas y no debe presentarse como un registro exhaustivo de todas las modificaciones posibles.')

page('10 Verificación e instalación')
h('Pruebas realizadas')
p('La ejecución del 11 de octubre de 2026 completó 46 pruebas automatizadas, con 46 aprobadas y ninguna fallida. Se ejercitaron saldos, abonos, excedentes, autenticación, cambios de estado, movimientos de inventario, consumo de materiales, liquidaciones y validaciones de fotos y fechas. Las pruebas utilizan dependencias simuladas; no certifican el comportamiento integral de la instalación MySQL del taller.')
p('Durante la verificación del desarrollo también se completaron compilación y lint del frontend, y pruebas manuales aisladas de consumo, historial y agenda. Estas evidencias corresponden al código y a escenarios de prueba, no a una aceptación operativa final de todas las pantallas con datos reales.')
h('Incidencia de rutas no encontradas')
p('El usuario reportó respuestas de Ruta no encontrada en historial, agenda, liquidaciones y corrección de cobros del seguro. En el código están declaradas las rutas /api/taller, /api/liquidaciones y la corrección de pagos. Una posible causa es que la interfaz actualizada esté conectada a un backend anterior; esa hipótesis necesita confirmación en el proceso que escucha el puerto de la API.')
p('El cierre de la incidencia requiere comprobar la dirección VITE_API_URL, el proceso y la carpeta desde donde se inicia el backend, el orden de montaje de rutas y el resultado de las migraciones. Una respuesta 404 indica que no se encontró la ruta solicitada; una respuesta 401 corresponde a autenticación, y una falla de base de datos requiere revisar el registro del servidor. No son el mismo problema.')
h('Inicio y actualización local')
bullets(['Configurar backend/.env con los datos de MySQL y un JWT_SECRET privado. No publicar las credenciales.', 'En una instalación nueva, crear el esquema inicial. En una instalación con datos, respaldar antes de actualizar y no ejecutar el reset ni recrear todo el esquema.', 'Instalar las dependencias e iniciar el backend desde su carpeta con npm start. El arranque aplica la preparación aditiva de tablas.', 'Iniciar el frontend con npm run dev y verificar VITE_API_URL. La API utiliza por defecto http://localhost:3001.', 'Volver a iniciar sesión cuando corresponda y comprobar el recorrido completo con una base de pruebas.'])
p('Los respaldos deben incluir fotos y sesiones junto con el resto de las tablas. Además de crear copias, se necesita comprobar su restauración. El reset destructivo está deshabilitado salvo habilitación explícita en desarrollo y autorización de administrador.')

page('11 Mejoras previstas y conclusiones')
h('Prioridades de mejora')
bullets(['Resolver y verificar la incidencia de rutas con la aplicación y la base de datos activas.', 'Completar pruebas de integración con MySQL para consumo simultáneo, cobros concurrentes, liquidaciones y recuperación ante errores.', 'Definir conciliación de excedentes, devoluciones y correcciones o anulaciones de liquidaciones con trazabilidad.', 'Formalizar migraciones versionadas y reforzar restricciones de unicidad cuando las reglas de negocio lo requieran.', 'Continuar separando pantallas extensas y mejorar las consultas de historiales conforme crezca el volumen de registros.', 'Desarrollar, si el taller lo necesita, recordatorios de citas, capacidad por trabajador e integración real con aseguradoras.'])
h('Evolución funcional')
p('El crecimiento del sistema debe concentrarse primero en estabilizar los recorridos existentes. Un registro completo debe permitir pasar del cliente al vehículo, de este a la orden y de la orden a sus recursos, cobros y costos. Las funciones futuras deben conservar esas relaciones y definir cómo se corrigen errores sin perder la trazabilidad de los movimientos.')
p('La integración con aseguradoras y el almacenamiento externo de archivos son ampliaciones posibles. Su incorporación requiere definir permisos, referencias y procedimientos de confirmación. En el alcance actual, los cobros del seguro se registran internamente y las fotografías se almacenan en MySQL.')
h('Beneficios esperados')
p('El historial por vehículo facilita revisar trabajos anteriores; los movimientos de inventario permiten conocer el uso de materiales; y los saldos separados ayudan a identificar a quién corresponde cada deuda. Las liquidaciones relacionan pagos con trabajos concretos, mientras que la agenda y las fotos complementan el seguimiento de recepción, reparación y entrega.')
p('Estos beneficios dependen de registrar datos completos y de mantener procedimientos consistentes. La calidad del sistema también requiere revisar costos, asignar correctamente los responsables, documentar las diferencias de cobro y comprobar los respaldos. La aplicación apoya esas tareas, pero no reemplaza la revisión administrativa del taller.')
h('Conclusiones')
p('El proyecto cuenta con una base relacional coherente y funciones que cubren buena parte del trabajo cotidiano del taller. La siguiente prioridad es estabilizar su ejecución completa con MySQL y cerrar las incidencias observadas. La ampliación del alcance debe acompañarse de pruebas de integración y procedimientos de corrección, para conservar consistencia cuando se registren movimientos reales.')

ROOT.mkdir(parents=True,exist_ok=True)
doc.save(OUT)
print(OUT)
