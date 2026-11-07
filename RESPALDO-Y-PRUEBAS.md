# Respaldo, recuperación y pruebas del taller

## Resultado del 3 de noviembre de 2026 (hora de Nicaragua)

Se creó un respaldo de la base configurada y se recuperó en una base nueva, sin reemplazar la original. La comparación verificó estructura y datos de 35 tablas y 424 registros, incluidas las 3 fotos almacenadas en `foto_orden`.

- Archivo: `.private-backups/taller-2026-11-04T00-03-47-657Z.sql` (el nombre usa UTC).
- Informe y huella SHA-256: el mismo nombre terminado en `.sql.json`.
- Base recuperada verificada: `taller_restore_1793750850816`.
- La primera recuperación, `taller_restore_1793750639713`, se conserva como diagnóstico. La diferencia detectada fue una declaración redundante `CHARACTER SET utf8mb4` en las columnas. La comparación normaliza únicamente esa representación; no elimina diferencias de registros.

## Crear otro respaldo

Abrir una terminal en la carpeta `backend` del proyecto y ejecutar:

```powershell
npm run backup
```

El comando usa la conexión de `backend/.env`, genera un SQL y un informe JSON en la carpeta configurada por `backend/backup.config.json` (actualmente `C:/Users/m1xim/OneDrive/Desktop/Respaldos Taller Espinoza`). La variable `BACKUP_DIR` permite sobreescribir ese destino; sin configuración se usa `.private-backups`. No modifica registros ni ejecuta migraciones. Si falla, no lo presenta como respaldo completo.

No cambiar la estructura de la base mientras se exporta. El respaldo usa una instantánea consistente de las tablas InnoDB. Incluye las fotos guardadas en MySQL, usuarios, pagos, inventario y demás tablas, además de vistas, rutinas, eventos y disparadores que exporte mysqldump.

## Comprobar la recuperación

Copiar la ruta SQL que imprimió el comando anterior:

```powershell
npm run backup:verify -- "RUTA_COMPLETA_DEL_ARCHIVO.sql"
```

Se comprueba la huella del archivo, se crea una base nueva `taller_restore_...`, se importa el SQL y se vuelve a exportar. Solo se registra `verified: true` cuando las exportaciones coinciden tras normalizar la declaración de codificación mencionada arriba. También se cuentan los registros por tabla. Nunca se importa encima de una base existente. La base de recuperación se conserva para inspección.

El script necesita MySQL Server 8.0 instalado y el servicio iniciado. La ubicación predeterminada de las herramientas es `C:/Program Files/MySQL/MySQL Server 8.0/bin`. Si cambia, configurar `MYSQL_BIN`. Si MySQL exige permisos para crear bases, usar una conexión autorizada para la comprobación.

Para recuperar el uso del sistema tras una pérdida: conservar la base dañada, verificar el respaldo, detener el backend y apuntar DB_NAME de su configuración a la base recuperada. Después iniciar el servidor y comprobar acceso, órdenes, saldos y fotos antes de volver al trabajo. Este cambio NO se hizo en esta revisión.

## Dónde guardar las copias

La carpeta local protege frente a errores de datos, pero no frente a una avería del disco. Copiar juntos el SQL y su JSON a un disco externo o almacenamiento privado fuera de este equipo. Contienen datos del taller: no publicarlos en GitHub ni compartirlos como ejemplos. Conservar también una copia privada del código y de la configuración necesaria; este SQL no es una copia del programa ni de sus archivos .env.

Desde el 5 de noviembre de 2026 se programó una automatización diaria de Codex a las 18:00, hora de Nicaragua. Requiere el equipo, Codex y MySQL disponibles y los permisos de ejecución necesarios. No es una tarea del Programador de tareas de Windows. También se puede ejecutar manualmente antes de actualizar el sistema. No se configuró borrado automático de copias ni se comprobó la sincronización con OneDrive.

## Pruebas con MySQL real

Desde `backend`:

```powershell
npm run test:mysql
```

Crea una base nueva `taller_proformas_qa_...` y ejecuta pruebas sobre ella: migraciones repetidas, cálculos, emisión/conversión concurrente de proformas, versiones, reparto de importes entre cliente y seguro, conservación de datos, rollback, búsquedas y citas. Las pruebas de rutas usan MySQL real, pero invocan sus manejadores directamente; no sustituyen comprobar el navegador y la autenticación HTTP.

Para abrir esa base de prueba desde la aplicación, en una terminal dentro de `backend`:

```powershell
node test/proformas-preview.cjs
```

En otra terminal dentro de `frontend`:

```powershell
$env:VITE_API_URL = 'http://localhost:3002'
npm run dev -- --host 127.0.0.1 --port 5185 --strictPort
```

Entrar a `http://127.0.0.1:5185`. Es una instalación de pruebas separada. Acceso de la base QA: `admin@tallerespinoza.com` / `DemoProformas2026!`. El botón que rellena la cuenta habitual no pone esta contraseña: escribirla manualmente. Al terminar, cerrar ambos servidores con Ctrl+C y cerrar la terminal del frontend para no reutilizar su variable de pruebas. No apuntar las pruebas manuales a la instalación habitual.

## Recorrido manual guiado

El flujo ya existe. Estas comprobaciones sirven para verificar sus conexiones y resultados:

1. Crear un cliente y vehículo de prueba, elaborar y aprobar su presupuesto, convertirlo en orden. Comprobar que cliente, matrícula e importes se conservan y que no se duplica al repetir un clic.
2. En una orden particular de C$50,000, registrar C$5,000 y C$3,000: debe quedar C$42,000. Registrar el resto: debe aparecer pagado y dejar de ofrecer nuevos abonos. Intentar un importe mayor al saldo: debe mostrar una validación sin alterar el saldo.
3. En una orden de C$21,000 con C$9,000 a cargo del cliente y C$12,000 del seguro, pagar primero la parte del cliente y después la del seguro. Cada parte debe conservar su saldo independiente. C$20,000 de total con esas dos obligaciones sumaría C$1,000 de diferencia: definir antes si se corrige el total o se registra un excedente; no ocultarlo.
4. Registrar un material con 10 unidades y consumir 2 en la orden: deben quedar 8, con el consumo asociado y su movimiento. Intentar consumir 9 más: debe rechazarlo. Recargar la página para comprobar persistencia.
5. Agendar una cita, buscarla en la semana correspondiente, completarla. Intentar dos citas solapadas del mismo vehículo y comprobar el rechazo. Buscar la orden por matrícula, cliente y número desde la barra superior.
6. Asignar un trabajador con un importe acordado, terminar el trabajo y preparar la liquidación. Confirmar que el mismo trabajo no se pague dos veces.
7. Adjuntar fotos de recepción/entrega, revisar costos y ganancia, marcar listo y entregado. Consultar el historial del vehículo y verificar que la reparación permanezca.
8. Registrar por cada paso: dato inicial, acción, resultado esperado, resultado obtenido y captura si falla. Las comprobaciones 2, 3, 4, 6 y 7 siguen siendo una guía de prueba manual integral; no se declaran ejecutadas por haber pasado la suite de proformas.

No se añadieron roles nuevos ni se retiraron módulos. Se mantienen los registros internos existentes para diagnóstico.

## Comprobaciones ejecutadas en esta revisión

- Backend: 45 pruebas automatizadas correctas (incluyen simulaciones de pagos, consumo, estados y errores).
- Frontend: 6 pruebas correctas, incluyendo semanas que cruzan de año y fecha bisiesta.
- Suite de integración MySQL: correcta. Usa una base nueva real y comprobó también búsqueda por matrícula/cliente/número, cita entre semanas, rechazo de solapamientos y cierre de cita.
- Compilación frontend y revisión ESLint de los archivos modificados: correctas. Vite conserva la advertencia de tamaño del paquete principal; no impide compilar.
- Recuperación del respaldo: correcta, como se detalla al inicio.
- La agenda semanal y la búsqueda se comprobaron en código y en sus consultas reales; queda el recorrido visual integral en el navegador junto con la administración.

Después de actualizar estos archivos, reiniciar el backend y el frontend de la instalación habitual para que la nueva ruta de búsqueda esté disponible. La búsqueda está limitada a órdenes registradas; permite encontrarlas por cliente, matrícula o número, y abre su expediente. No es un buscador de archivos del equipo.

## Pagador único y trabajos particulares

Las órdenes nuevas tienen `pagador_unico=1`: si son INISER/LAFISE el saldo completo es del seguro; si son particulares, del cliente. El saldo del seguro sigue el costo total al recalcular los trabajos. No se permite distribuir el pago de esas órdenes ni registrar abonos del cliente en órdenes nuevas aseguradas. Se permiten abonos sucesivos del mismo pagador.

La migración añade la columna sin convertir los registros anteriores: las órdenes históricas mantienen `pagador_unico=0` y sus pagos y saldos originales. No se reasigna dinero recibido. Se ejecuta al reiniciar el backend.

El módulo Trabajos particulares lista las órdenes particulares y ofrece un recorrido de tres pasos: cliente, vehículo y reparación. En el paso de reparación se requiere al menos una actividad, con descripción, precio antes de IVA y selección de IVA del 15%. La orden, las actividades y sus totales se guardan en una sola transacción. Los trabajos quedan disponibles en Operaciones y se cobran desde Pagos. Las órdenes convertidas desde una proforma conservan sus conceptos sin duplicarlos.

Verificado: 46 pruebas backend, compilación y ESLint; pruebas MySQL en base aislada de creación de orden particular sin referencias de seguro, orden asegurada sin reparto y conversión de proforma asignando el total al seguro.

Verificación de actividades particulares: 49 pruebas backend correctas; compilación y ESLint correctos. En MySQL aislado se verificaron actividades guardadas, subtotal e IVA, recálculo sin duplicación, rechazo de actividades vacías y reversión completa cuando falla su inserción.

## Formato de registro particular

El último paso de Trabajos particulares usa el formato visual de proformas: cliente y vehículo, trabajos y repuestos, observaciones y resumen lateral. Mantiene Particular como pagador fijo y crea directamente una orden mediante Registrar trabajo. No solicita reclamo, trámite ni autorización de aseguradora.

Admite monto global de mano de obra (IVA 15%) o precio por trabajo, conceptos de repuesto/material, cantidades e IVA por concepto. El monto global se cobra una sola vez; sus actividades permanecen descritas con importe cero. Los conceptos originales y observaciones se conservan en orden_particular_documento, creada automáticamente al reiniciar el backend, y las observaciones se muestran en Operaciones. Los cargos se trasladan a orden_servicio; el consumo posterior de los materiales incluidos afecta inventario y costos sin volver a cobrar esos conceptos.

Validación: 52 pruebas backend correctas, ESLint y compilación correctos. MySQL aislado verificó monto global con repuestos, cantidades y observaciones, pagador particular, ausencia de referencias de aseguradora y recálculo sin duplicación.

## Correcciones del 4 de noviembre de 2026

Garantía y vencimiento se guardan desde el formulario y la conversión de proformas. La entrega no puede preceder al ingreso; se aceptan entregas el mismo día. La creación directa exige un identificador de solicitud generado por el formulario para impedir duplicación incluso con solicitudes simultáneas. La migración aditiva crea orden_solicitud al reiniciar el backend; no modifica las órdenes existentes.

Resultado: 55 pruebas backend y 6 frontend correctas, compilación y ESLint correctos, integración MySQL y solicitudes HTTP reales correctas. Detalles en artifacts/qa/INFORME-PRUEBAS.md.

## Login y validaciones — 4 de noviembre de 2026

Se corrigieron los hallazgos de artifacts/qa/LOGIN-Y-VALIDACIONES.md: límites temporales de login persistidos en MySQL (5 intentos por cuenta/IP y 30 por IP en ventanas de 15 minutos), normalización del correo, validación de clientes/vehículos/inventario y errores claros. Reiniciar backend para la migración aditiva login_intento y recargar el frontend. No se modificaron las cuentas ni los registros anteriores. Verificado con 58 pruebas backend y 25 comprobaciones HTTP, incluyendo concurrencia, recuperación tras vencimiento y registros válidos.

## Respaldo automático configurado el 5 de noviembre de 2026

- Automatización de Codex: `respaldo-diario-del-taller-espinoza`, activa, diaria a las 18:00 (America/Managua).
- Destino: `C:/Users/m1xim/OneDrive/Desktop/Respaldos Taller Espinoza`.
- Copia inicial: `taller-2026-11-06T00-56-38-715Z.sql` (nombre en UTC; creada el 5 de noviembre en Nicaragua).
- Recuperación comprobada en `taller_restore_1793926877656`: 39 tablas y 629 registros. La base original permanece intacta.
- Cada ejecución crea un archivo nuevo y su manifiesto SHA-256. La automatización comprueba la integridad de la copia; no restaura automáticamente cada día.
- Las credenciales temporales de MySQL se guardan fuera del Escritorio, en una carpeta temporal, y se eliminan al finalizar.
- Los archivos SQL contienen datos del taller. La ubicación pertenece al Escritorio de OneDrive; que exista una copia local no confirma que ya se haya sincronizado a la nube.

## Respaldo diario con el Programador de tareas de Windows (6 de noviembre de 2026)

La automatización de Codex solo se ejecuta si la aplicación Codex está abierta a las 18:00. El 6 de noviembre
no generó respaldo. Desde esta fecha el respaldo diario no depende de Codex:

- Tarea de Windows: `Respaldo diario Taller Espinoza`, todos los días a las 18:00, con el usuario de esta PC.
  Si la PC está apagada o la sesión cerrada a esa hora, se ejecuta en cuanto vuelva a estar disponible.
  Reintenta 2 veces, cada 10 minutos, si falla.
- Ejecuta `backend/scripts/respaldo-diario.ps1`: crea el SQL con `scripts/backup.cjs create` y comprueba que
  su huella SHA-256 coincide con el manifiesto.
- Cada ejecución queda anotada en `respaldo-diario.log`, en la misma carpeta de respaldos: `OK` con el nombre
  del archivo, o `FALLO` con el motivo (por ejemplo, MySQL apagado).
- Prueba del 6 de noviembre: ejecución manual y desde el Programador de tareas, ambas `OK` (5.24 MB).
  Recuperación verificada en `taller_restore_1794029216443`: 40 tablas y 774 registros.
- Para revisarla: Programador de tareas de Windows → Biblioteca → `Respaldo diario Taller Espinoza`.
  Para ejecutarla ya: clic derecho → Ejecutar. Para quitarla: clic derecho → Eliminar.
- Requisitos: la PC encendida, el servicio de MySQL iniciado y Node.js instalado.
- La automatización de Codex sigue activa en Codex. Si Codex está abierto a las 18:00 se crea una copia extra;
  puede pausarse desde Codex sin afectar la tarea de Windows.
- Los archivos no se borran automáticamente (unos 5 MB por día). Revisar la carpeta de vez en cuando y
  conservar al menos las copias recientes y una por mes.
