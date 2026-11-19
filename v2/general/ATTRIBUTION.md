# Atribución V2 — cobertura almacenada equivalente a V1

**Actualización de despliegue candidato:** paso2 general preparado/verify-live
real pass, sin Stitch/Background. Esto no migra V1 ni cambia los límites de cobertura
de esta tool. Ver PASO2-CIERRE.md; conteos/estado iniciales de abajo son históricos.

## Estado

Implementado en el candidato general2.2.7, no instalado. La tool existente
`agent_attribution` recupera las páginas almacenadas de **la sesión actual**, como
el plugin V1 (`plugins/agent-identity.ts`, client.session.messages), en vez de usar
sólo la ventana del modelo. Mismo permiso, input vacío, sin tool/actor/ask nuevos.
El hook que informa el agente ejecutor al modelo se conserva.

Esto recupera D06 en fuente/fixtures. **No cierra D01**: no se importó ni validó el
historial V1 real, no se probaron backups/restores ni se certificó el corte.

## Alcance del resultado

| Modo | Selección | Resultado |
|---|---|---|
| General | options.history:stored | scope:stored-session-history, completeHistory:true sólo al agotar páginas |
| Workshop histórico | sin opción | scope:model-visible-context, completeHistory:false como antes |

- Orden ascendente, paginación hasta agotarla; sin nueva cuota total de mensajes.
  Página100 por defecto; pageSize interno puede reducirse para pruebas (pin1–100).
- Se proyecta cada página inmediatamente a índice/tipo/agente/modelo/variante;
  nunca texto, reasoning, argumentos/resultados de tools, títulos, adjuntos, resumen
  o native blobs al modelo/archivo. La API HTTP sí devuelve cuerpos en RAM: no
  tiene proyección server-side en este pin. No export/SQL/DB V1.
- Datos históricos del mensaje, no agente/modelo actual de la sesión. Ausentes
  siguen unknown-agent/provider/model como V1, sin reconstruirlos por suposición.
  Compaction es un tipo nativo separado y conserva su modelo si está publicado;
  no se inventa un agente productor para ella.
- completeHistory significa **todas las filas almacenadas enumeradas de esta
  sesión**, no transacción atómica, otras sesiones/familia, trabajo borrado/externo,
  equivalencia V1/V2 o integridad de una migración. El resultado declara ese límite.
  Un fork enumera sus propias filas, incluidas copias; no atribuye gasto nuevo.
- Error/cancelación/cursor repetido/ID duplicado no devuelven una parte como total.
  El modo stored no cae silenciosamente a session.context si falla el transporte.
  Permiso existente comprobado antes de leer; ningún parámetro de sesión ajena.

## Transporte común y límites de confianza

Plugin.Context2.2.7 tiene session.context pero no session.message/list ni el client
completo (contrato publicado dist/promise/{plugin,session}.d.ts). Se reutiliza el
HTTP público `/api/session/{sessionID}/message` que ya usaba benchmark, no core privado.

`v2/native-history.mjs` pertenece a base, junto al launcher/host. El shim de CodeGraph
reexporta ese transporte con el mismo layout sibling en source y bundle; base no
depende de un addon para atribución. `owned-server.mjs` mantiene el pipe fd3 sólo RAM,
PID/loopback/shape validados y auth efímera cerrada dentro del lector; no auth file,
argv, nueva variable secreta, daemon ajeno o endpoint configurable. Sólo GET list/get,
sin redirects; timeout/cancelación/límite8MiB por página y errores sin bodies/auth.

**Gotcha comprobado del cargador:** el pin compila imports por plugin; mismo archivo
no implica mismo estado de módulo. La primera prueba en ambos órdenes falló porque
el segundo plugin intentó leer fd3 ya cerrado. Ahora se publica una sola función
GET acotada en RAM del host bajo Symbol.for, con auth en su closure, **no** descriptor
URL/password como propiedad global. Descriptores no enumerables/no reemplazables,
sin nuevo RPC/tool/API remota. El segundo módulo usa esa función sin releer el pipe.
No es sandbox contra plugins confiables/debuggers del mismo proceso/UID; los
consumidores siguen responsables de permisos y proyección antes de modelo/archivos.

El modo general usa el launcher propio ya existente. Fuera de ese host identificado
no busca credenciales/DB por fallback ni promete stored history; requiere el wiring
compatible, no un nuevo login. Assets/reinicio de host propios del despliegue futuro,
sin cambiar ahora clientes/workshop/globales.

## Evidencia reproducible

```text
node --test v2/general/test/identity*.test.mjs
node --test v2/general/test/*.test.mjs
KNOWLEDGE_API_NATIVE=1 node --test migrations/v2/test/*.test.mjs
node migrations/v2/smoke-general-addons.mjs
node migrations/v2/smoke-workshop.mjs
```

6 pruebas específicas:4 unit y2 nativas oficiales, páginas de2 filas, cambio
master-dev→planner, compactación que realmente saca el assistant viejo del contexto,
histórico previo recuperado, fork con atribución copiada, deny nativo y benchmark
coexistiendo en ambos órdenes.10 requests explícitos al proveedor mock por caso,
sin inferencia propia del lector;0 proveedores/datos/DB originales. Test de transporte
del owner CodeGraph carga además un clon de módulo para reproducir el problema del
bundler y comprueba servicio opaco sin campos de credenciales/redirects/fallbacks.

Total actual72 Node+3 Python general,14 Node+57 Python CodeGraph(56 OK/1 opt-in skip),
100 regresiones migración/41 composición/11 workshop OK. Debug config oficial en
perfiles temporales cubierto; plan/status real227 assets,not-prepared/not-distributed.
Falta instalación/uso real autorizados, resto de paridad/capas y D01 integral.
