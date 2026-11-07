# Correcciones verificadas — 4 de noviembre de 2026

Los tres hallazgos de la revisión anterior están corregidos:

- Garantía: el formulario envía la casilla de cobertura y guarda su vencimiento. También se conserva al convertir una proforma aprobada; una orden derivada continúa identificándose por su orden de origen.
- Fechas: se valida el calendario, la hora y que entrega/garantía no precedan al ingreso. La entrega el mismo día se permite. La validación se aplica a creación directa, conversión de proforma y cambio de entrega desde expediente.
- Duplicados: cada formulario conserva un identificador durante sus reintentos. El servidor registra la solicitud y su respuesta en la misma transacción que la orden, usando una clave única por usuario. Dos envíos simultáneos o un reintento tras perder la respuesta devuelven la misma orden. Reutilizar la clave con otros datos devuelve conflicto; un fallo revierte también la solicitud. Solicitudes sin identificador se rechazan con indicación de recargar el formulario.

Verificado: 55 pruebas backend, 6 frontend, ESLint de archivos modificados y compilación correctos. MySQL aislado comprobó persistencia de garantía, conversión con garantía, rechazo de fechas inválidas, reintentos concurrentes y posteriores, protección contra cambio de datos y rollback. Las solicitudes HTTP reales al servidor QA del puerto 3003 confirmaron garantía, fechas, duplicados, autenticación y abonos hasta completar saldo.

Base utilizada: taller_proformas_qa_1793844179007. No se alteraron los registros del taller. Para activar en la instalación habitual, reiniciar backend (crea orden_solicitud sin alterar órdenes anteriores) y recargar frontend. La advertencia de tamaño del paquete principal sigue pendiente. No se completó una revisión visual de navegador en esta sesión.

El registro JSON system-check.json contiene la última comprobación HTTP. La revisión del 3 de noviembre se conserva a continuación como antecedente; sus errores ya no representan el estado actual.

---

# Pruebas del sistema — 3 de noviembre de 2026

Se utilizó la base aislada taller_proformas_qa_1793759336782. No se modificaron registros del taller. Esta revisión agrega pruebas y evidencia; no corrige la lógica de negocio.

## Resultado general

- 52 pruebas backend y 6 frontend correctas.
- ESLint completo del frontend: correcto.
- Compilación: correcta, con advertencia por paquete principal de 524.32 kB (133.23 kB comprimido).
- Integración MySQL: correcta (proformas, particulares, migraciones repetidas, totales, concurrencia, agenda, búsqueda y rollback).
- HTTP real: autenticación, bloqueo sin sesión y consulta de órdenes particulares, vehículos, agenda, inventario y proformas correctos.
- HTTP real: abonos 500 + 300 + 200 sobre una deuda de 1000; rechaza otro abono con HTTP 409.

## Problemas encontrados

1. **Alta: garantía perdida al registrar trabajo particular.** El checkbox modifica esGarantia, pero el payload usa esDerivada para es_garantia. En una reparación normal envía false junto con el vencimiento; el backend descarta la fecha. Revisado en código y reproducido con la solicitud HTTP equivalente: orden QA 7 guardada con es_garantia=0 y fecha null. Corregir la distinción entre trabajo con cobertura y reparación derivada por garantía, y probar el formulario completo.
2. **Media: fecha de entrega anterior al ingreso.** Una orden con ingreso 03/11/2026 y entrega 02/11/2026 se guardó (HTTP 201, QA 8). Añadir validación cronológica en servidor y formulario.
3. **Alta: duplicación al reintentar creación.** La misma solicitud se envió dos veces y produjo órdenes QA 9 y 10. El botón ocupado limita clics mientras espera, pero no protege un reintento después de perder la respuesta. Implementar identificador de solicitud y unicidad transaccional.

## Alcance y límites

La verificación fue automatizada, por revisión de código y por solicitudes HTTP reales al servidor QA. El navegador integrado no pudo conectar al frontend local (ERR_CONNECTION_TIMED_OUT); no se completó un recorrido visual ni móvil. No se certifica ausencia de errores en módulos no recorridos. No se repitió la restauración de respaldos en esta sesión.

Evidencia detallada: system-check.json. Reproducción: iniciar backend/test/proformas-preview.cjs sobre la base QA creada por proformas-mysql.cjs; establecer QA_HTTP_TEST=1 y ejecutar backend/test/system-http-check.cjs. El script crea datos exclusivamente para estas pruebas; usar solo el servidor QA en puerto 3002.
