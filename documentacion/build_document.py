from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).parent
OUT = ROOT / 'Documentacion_actualizada_Taller_Espinoza.docx'
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
doc.core_properties.subject = 'Avance funcional arquitectura y modelo de base de datos'
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
p('Avance funcional arquitectura y modelo de base de datos','Subtitle')
p('Actualización del 11 de octubre de 2026')
h('Equipo del proyecto')
p('Hashel Ignacio López Arguello\nJosé Neftalí Tapia Álvarez\nMaximiliano Guido Torres')
p('Grupo 3T3-COM-S\nDocente Ing. Euclides')
h('Presentación')
p('El proyecto organiza la atención de clientes y vehículos, las reparaciones, el consumo de materiales y el control de pagos del taller. La implementación incorpora una interfaz web, un servidor de servicios y una base de datos MySQL de modelo relacional. Las ampliaciones recientes incluyen historial por vehículo, agenda, fotos, costos por orden y liquidaciones por trabajos realizados.')
p('Esta documentación actualiza el planteamiento del 7 de septiembre de 2026 y explica el funcionamiento desarrollado, las reglas de negocio y la estructura de los datos. El avance dispone de pruebas automatizadas, pero la instalación del usuario presenta una incidencia de rutas no encontradas que impide considerar cerrada su validación operativa.')
h('Contenido')
for line in ['1 Contexto objetivos y alcance','2 Arquitectura y tecnologías','3 Operación del taller e inventario','4 Pagos y liquidaciones','5 Historial agenda fotos y costos','6 Modelos de datos utilizados','7 Organización del esquema de datos','8 Relaciones y cardinalidades','9 Integridad transacciones y seguridad','10 Verificación e instalación','11 Pendientes y referencias del proyecto']:p(line)

page('1 Contexto objetivos y alcance')
h('Antecedentes')
p('El planteamiento inicial identifica problemas derivados del uso de papel, hojas de cálculo y anotaciones separadas: dificultad para relacionar una reparación con sus materiales, falta de claridad sobre los abonos, cambios de precios que afectan la interpretación del historial y confusión sobre los trabajos ya pagados al personal. Estas necesidades justifican centralizar la información alrededor de la orden de trabajo.')
p('Durante el desarrollo se detectaron además botones sin conexión con acciones del servidor, respuestas HTML interpretadas como JSON, validaciones numéricas insuficientes y controles de acceso incompletos. El trabajo posterior abordó estos puntos y amplió el sistema con funciones operativas solicitadas por el usuario.')
h('Objetivo general')
p('Desarrollar un sistema web para administrar el ciclo de atención del Taller Pedro Espinoza, relacionando clientes, vehículos, órdenes, recursos utilizados, cobros y pagos al personal mediante información consistente y consultable.')
h('Objetivos específicos')
bullets(['Registrar clientes, vehículos, presupuestos y órdenes de trabajo relacionadas.', 'Controlar estados de reparación y conservar un historial por vehículo.', 'Descontar materiales utilizados y registrar movimientos con su orden y responsable.', 'Acumular abonos y distinguir los saldos del cliente y de la aseguradora.', 'Registrar liquidaciones por trabajos y evitar que una asignación se liquide dos veces.', 'Incorporar citas, fechas de entrega, fotografías y costos para apoyar el seguimiento del taller.', 'Aplicar autenticación, permisos y validaciones en el servidor.'])
h('Alcance del avance')
p('La aplicación está dirigida a administración y secretaría. El personal técnico se registra como trabajador asignado; ese registro no equivale a una cuenta de acceso independiente. El sistema administra información y comprobantes internos, sin ejecutar transferencias bancarias ni comunicarse automáticamente con aseguradoras.')
p('La liquidación implementada corresponde al pago por trabajos realizados. No calcula prestaciones laborales por terminación de contrato. La ganancia por orden es una estimación basada en los costos registrados y no sustituye un sistema contable completo.')

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

page('6 Modelos de datos utilizados')
p('El modelo de base de datos implementado es relacional. MySQL es el sistema gestor que ejecuta ese modelo; SQL es el lenguaje utilizado para definir y consultar las tablas. El MER y el MERE pertenecen al diseño conceptual: ayudan a representar el negocio antes de concretarlo en tablas y restricciones.')
table(['Modelo o nivel','Uso en el proyecto','Ejemplo'],[
('Entidad relación\nMER','Representación conceptual de entidades, vínculos y cardinalidades.','Un cliente puede tener varios vehículos.'),
('Entidad relación extendido\nMERE','Documentación conceptual de mayor detalle. No constituye otro motor de datos.','Relación recursiva de orden y atributos representativos.'),
('Relacional','Modelo lógico implementado mediante tablas, claves y relaciones.','orden.id_vehiculo referencia vehiculo.id.'),
('Implementación física','Esquema SQL de MySQL y estructuras creadas por migraciones.','DECIMAL, DATETIME, índices y MEDIUMBLOB.'),
('Orientado a objetos','No se utiliza como modelo de persistencia.','Los objetos JavaScript de la aplicación no son objetos persistidos en una base orientada a objetos.'),
('Documental NoSQL','No implementado como base de datos.','Las respuestas JSON son intercambio de datos, no almacenamiento en una base documental.')],[1.35,2.65,2.6])
h('Diferencia frente a una base orientada a objetos')
p('Una base orientada a objetos conserva objetos con identidad y estructuras propias de ese modelo. En este proyecto los clientes, vehículos y órdenes se conservan como filas relacionadas mediante identificadores. La presencia de componentes React y objetos JavaScript describe cómo se programa la aplicación, no modifica el modelo de MySQL.')
h('Precisiones del planteamiento inicial')
p('El documento original menciona MER y MERE como instrumentos de diseño. La implementación no evidencia jerarquías de herencia o especialización persistente entre clases. Tampoco emplea un modelo jerárquico, de red o de grafos como sistema de almacenamiento. La clasificación principal que corresponde presentar es base de datos relacional con modelado conceptual entidad relación.')

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
p('presupuesto_detalle y liquidacion_detalle dependen del registro principal para su significado de negocio, aunque ambas poseen una clave primaria propia. Por ello, llamarlas entidades débiles en sentido estricto requiere precisar la notación conceptual; en el esquema físico se describen mejor como tablas de detalle dependientes.')
h('Datos históricos y valores derivados')
p('El precio_unitario guardado en orden_material y orden_repuesto es una copia histórica tomada al registrar el uso. Se almacena precisamente para no depender del precio actual del catálogo; no es un atributo derivado calculado en cada consulta. En cambio, el saldo y el estado Pagado se calculan a partir de obligaciones y pagos.')
p('La preparación y el pago de una liquidación también son estados distintos. El registro en liquidacion_detalle indica inclusión, y la cabecera liquidacion_personal determina si se pagó. El control de no duplicar una asignación se aplica mediante lógica transaccional; el esquema original no declara una restricción UNIQUE sobre id_orden_personal.')
h('Atomicidad y concurrencia')
p('Las transacciones agrupan cambios relacionados: consumo y descuento de stock, registro de pagos y auditoría, o preparación de liquidaciones. Si falla una operación del grupo, se solicita rollback. Los bloqueos SELECT FOR UPDATE serializan accesos a registros críticos para evitar que dos solicitudes utilicen simultáneamente el mismo saldo disponible.')
p('Los importes monetarios se almacenan en columnas DECIMAL y el servicio de saldos calcula en centavos. Se rechazan valores inválidos, negativos, pagos de cero y fracciones de centavo. Las garantías reales de concurrencia deben comprobarse también con el motor MySQL y su configuración de tablas transaccionales.')
h('Acceso y registro de acciones')
p('Las contraseñas se verifican con bcrypt. El inicio de sesión genera un JWT de ocho horas con identificador asociado a sesion_usuario. El servidor verifica la sesión y el usuario activo; cerrar sesión elimina la sesión registrada. Administración tiene permisos adicionales para ajustes, costos y liquidaciones. La auditoría cubre acciones específicas y no debe presentarse como un registro exhaustivo de todas las modificaciones posibles.')

page('10 Verificación e instalación')
h('Pruebas realizadas')
p('La ejecución del 11 de octubre de 2026 completó 46 pruebas automatizadas, con 46 aprobadas y ninguna fallida. Se ejercitaron saldos, abonos, excedentes, autenticación, cambios de estado, movimientos de inventario, consumo de materiales, liquidaciones y validaciones de fotos y fechas. Las pruebas utilizan dependencias simuladas; no certifican el comportamiento integral de la instalación MySQL del taller.')
p('En la revisión anterior también se completaron compilación y lint del frontend, y pruebas manuales aisladas de consumo, historial y agenda. Estas evidencias corresponden al código y a escenarios de prueba, no a una aceptación operativa final de todas las pantallas con datos reales.')
h('Incidencia de rutas no encontradas')
p('El usuario reportó respuestas de Ruta no encontrada en historial, agenda, liquidaciones y corrección de cobros del seguro. En el código están declaradas las rutas /api/taller, /api/liquidaciones y la corrección de pagos. Una posible causa es que la interfaz actualizada esté conectada a un backend anterior; esa hipótesis necesita confirmación en el proceso que escucha el puerto de la API.')
p('El cierre de la incidencia requiere comprobar la dirección VITE_API_URL, el proceso y la carpeta desde donde se inicia el backend, el orden de montaje de rutas y el resultado de las migraciones. Una respuesta 404 indica que no se encontró la ruta solicitada; una respuesta 401 corresponde a autenticación, y una falla de base de datos requiere revisar el registro del servidor. No son el mismo problema.')
h('Inicio y actualización local')
bullets(['Configurar backend/.env con los datos de MySQL y un JWT_SECRET privado. No publicar las credenciales.', 'En una instalación nueva, crear el esquema inicial. En una instalación con datos, respaldar antes de actualizar y no ejecutar el reset ni recrear todo el esquema.', 'Instalar las dependencias e iniciar el backend desde su carpeta con npm start. El arranque aplica la preparación aditiva de tablas.', 'Iniciar el frontend con npm run dev y verificar VITE_API_URL. La API utiliza por defecto http://localhost:3001.', 'Volver a iniciar sesión cuando corresponda y comprobar el recorrido completo con una base de pruebas.'])
p('Los respaldos deben incluir fotos y sesiones junto con el resto de las tablas. Además de crear copias, se necesita comprobar su restauración. El reset destructivo está deshabilitado salvo habilitación explícita en desarrollo y autorización de administrador.')

page('11 Pendientes y referencias del proyecto')
h('Prioridades de mejora')
bullets(['Resolver y verificar la incidencia de rutas con la aplicación y la base de datos activas.', 'Completar pruebas de integración con MySQL para consumo simultáneo, cobros concurrentes, liquidaciones y recuperación ante errores.', 'Definir conciliación de excedentes, devoluciones y correcciones o anulaciones de liquidaciones con trazabilidad.', 'Formalizar migraciones versionadas y reforzar restricciones de unicidad cuando las reglas de negocio lo requieran.', 'Continuar separando pantallas extensas y mejorar las consultas de historiales conforme crezca el volumen de registros.', 'Desarrollar, si el taller lo necesita, recordatorios de citas, capacidad por trabajador e integración real con aseguradoras.'])
h('Cambios respecto al documento inicial')
p('La propuesta de PostgreSQL se sustituye por la descripción de MySQL, que es el gestor usado por el código. Cloudflare R2 y Linker LAFISE se mantienen como posibilidades futuras, sin atribuirles integración operativa. Se precisa que los precios históricos son valores almacenados y que preparar una liquidación no equivale a pagarla. También se distingue entre funcionalidad desarrollada y funcionamiento validado en la instalación del usuario.')
h('Referencias internas')
p('Documento_Proyecto.docx, fechado el 7 de septiembre de 2026. Fuente del planteamiento, antecedentes y datos del equipo.')
p('README.md y arquitectura.md. Descripción de funcionamiento y planteamiento de evolución; los componentes propuestos se contrastan con el código.')
p('taller_espinoza.sql; backend/migrations/001_sessions.sql; backend/src/services/migrate.js. Estructura relacional inicial y ampliaciones.')
p('backend/src/routes y backend/src/services. Implementación de operaciones, pagos, inventario, agenda, fotos, costos y liquidaciones. backend/src/middleware y routes/auth.js documentan los controles de acceso.')
p('frontend/src/pages, frontend/src/components y frontend/src/lib. Pantallas, componentes y comunicación con la API. backend/test y frontend/test contienen las verificaciones automatizadas.')
h('Valoración del avance')
p('El proyecto cuenta con una base relacional coherente y funciones que cubren buena parte del trabajo cotidiano del taller. La siguiente prioridad es estabilizar su ejecución completa con MySQL y cerrar las incidencias observadas. La ampliación del alcance debe acompañarse de pruebas de integración y procedimientos de corrección, para conservar consistencia cuando se registren movimientos reales.')

ROOT.mkdir(parents=True,exist_ok=True)
doc.save(OUT)
print(OUT)
