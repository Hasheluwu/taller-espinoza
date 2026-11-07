# Correcciones verificadas — 4 de noviembre de 2026

Los hallazgos de esta revisión están corregidos. El diagnóstico original se conserva abajo como antecedente.

## Comportamiento actual

- Login: ventana de 15 minutos, máximo 5 intentos para una cuenta desde una IP y 30 intentos totales por IP. El ingreso correcto reinicia el contador de esa cuenta, pero no el límite general por IP. Al exceder el límite responde 429, con mensaje en español, segundos restantes y cabecera Retry-After. Los contadores se guardan en MySQL y se actualizan mediante transacciones, por lo que las solicitudes simultáneas no eluden el límite. El bloqueo es temporal; no desactiva la cuenta. El correo se normaliza también en el servidor.
- Clientes: texto obligatorio después de quitar espacios, longitudes máximas, teléfono de 8 a 15 dígitos con prefijo/separadores y nacimiento válido no futuro.
- Vehículos: texto obligatorio, año entero entre 1901 y el próximo año modelo, aseguradora del catálogo y cliente existente. Se mantiene la restricción de matrícula única.
- Inventario: nombre de tipo texto, obligatorio y de hasta 150 caracteres tanto al crear como al editar.
- Entradas mal formadas: los casos comprobados responden 400/404/409 con explicación en español, en vez de un error interno genérico. Los formularios incorporan límites de texto, fechas y año, y validación de espacios/teléfono.

## Verificación

58 pruebas backend correctas. Compilación frontend y ESLint de archivos modificados correctos. 25 comprobaciones HTTP correctas en la base QA: intentos repetidos, seis envíos simultáneos, límite por IP cambiando el correo, recuperación del acceso, logout, datos inválidos, creación válida y cédula duplicada. Para probar el vencimiento sin esperar 15 minutos, se adelantó únicamente el vencimiento de los contadores de la base QA y se comprobó que el login volviera a responder 200. No se modificaron registros del taller.

Reiniciar el backend para crear automáticamente login_intento y recargar el frontend. No se cambian contraseñas ni usuarios existentes. La protección usa la IP de la conexión recibida por Express; no se habilitó confianza indiscriminada en cabeceras de proxies. Si la instalación cambia a un proxy, su configuración debe revisarse.

El servidor QA se cerró al finalizar. No se realizó recorrido visual de navegador en esta sesión.

---

# Revisión de login y validaciones — 4 de noviembre de 2026

Alcance: revisión de código y 19 comprobaciones HTTP contra un proceso QA aislado (puerto 3004), conectado exclusivamente a taller_proformas_qa_1793844179007. Se crearon únicamente registros QA. El proceso de prueba se cerró al terminar. No se cambió la lógica de la aplicación ni se modificaron datos de producción.

## Hallazgos prioritarios

1. **Alta — No hay límite de intentos fallidos de login.** Veinte contraseñas incorrectas consecutivas produjeron HTTP 401 sin espera/bloqueo (no 429/423). No hay limitador en las rutas ni en la configuración de Express inspeccionada. Esto facilita probar contraseñas repetidamente; no significa que se haya conseguido acceso. Añadir limitación por origen y cuenta, espera temporal y mensaje con tiempo para reintentar, evitando bloquear permanentemente al único administrador.
2. **Media — Datos obligatorios vacíos tras quitar espacios.** Cliente con nombre/municipio de solo espacios y vehículo con marca/modelo de solo espacios: HTTP 201. El backend valida antes de trim, y los formularios usan required sin validación adicional de espacios. Validar después de normalizar, en servidor y formulario.
3. **Media — Fechas y años sin límites razonables.** Se aceptaron nacimiento 2099-01-01 y fabricación 2099 (HTTP 201). Los formularios no imponen max en estos campos. Validar nacimiento no futuro y fabricación dentro de un rango razonable; decidir explícitamente si se admite el próximo año modelo.
4. **Media — Teléfono inválido aceptado.** Se guardó abcdefgh (HTTP 201). Validar dígitos y longitud, conservando soporte para prefijos y separadores habituales.
5. **Media — Entradas incorrectas devuelven error interno en lugar de una explicación.** Nombre de cliente de 151 caracteres, nombre numérico, cliente inexistente al registrar vehículo, aseguradora fuera de catálogo y nombre numérico de inventario devolvieron HTTP 500. No todos son accesibles desde los controles normales; se probaron directamente contra la API. Añadir validación de tipo, longitud, referencias y catálogo antes de usar trim o escribir en SQL; responder 400/404/409 según corresponda.

## Detalles de menor prioridad

- La API de login no normaliza espacios del correo (401 con credenciales válidas rodeadas de espacios). El formulario YA aplica trim: no afecta ese flujo de pantalla actual. Normalizar también en servidor por consistencia.
- Cuerpo JSON null se rechaza correctamente con HTTP 400, pero la respuesta expone un mensaje técnico en inglés. Mejorar el mensaje de entrada inválida.

## Controles que funcionaron

- Acceso a órdenes sin sesión: 401.
- Token alterado: 401.
- Logout: 200; reutilización del mismo token: 401.
- Intento simple de inyección SQL en el correo: rechazado; consultas inspeccionadas utilizan parámetros. Esto no constituye una certificación de todas las rutas.
- Precio negativo en inventario: 400 con explicación.
- Pruebas unitarias de autenticación: tokens vencidos/antiguos/inválidos rechazados; requiere sesión activa y usa el rol actual de base de datos.

## Límites

No se realizó un recorrido visual del navegador ni una prueba de carga. Los intentos de login se limitaron a veinte sobre una cuenta QA, sin probar contraseñas reales del taller. La cuenta de demostración del frontend aparece solo en modo desarrollo; no se verificó si sus credenciales siguen habilitadas en la base habitual. No se afirma ausencia de otras vulnerabilidades.

Evidencia: auth-validation-check.json. Reproducción: establecer QA_AUTH_AUDIT=1 y ejecutar backend/test/auth-validation-audit.cjs después de preparar la base con proformas-mysql.cjs. La revisión no implementa las correcciones propuestas.
