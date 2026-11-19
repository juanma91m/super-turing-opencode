# Auditoría post-corte V2 — 2026-11-19

Este informe conserva el estado al iniciar la auditoría. La remediación y
publicación posteriores están en [MANTENIMIENTO-POST-CORTE.md](MANTENIMIENTO-POST-CORTE.md),
incluidos el despliegue Higyrus aún pendiente y la incidencia live Rovo posterior.

## Dictamen

**Instalación gestionada operativa, pero no corresponde declarar «todo OK».**
Los once proyectos pasan integridad/configuración y arranque efectivo. Hay un
fallo reproducido de resolución de Semgrep en Higyrus, una dependencia de ast-grep
no consolidada localmente y un bloqueo de servicio externo por cuota de Context7.
La fuente V2 sigue mayormente sin commit y la documentación de corte está atrasada.

Auditoría sin reinstalar, sincronizar, reparar, cambiar permisos, hacer commits,
fetch/push, indexar corpus/CodeGraph o consultar aplicaciones/infraestructura.
Este informe es el único archivo agregado por la auditoría. Los checks live crean
y eliminan sus sesiones diagnósticas propias y realizan el startup normal de MCP;
no son una operación sin escrituras de estado nativo. No se leyeron secretos/envs
reales ni cuerpos de conversaciones. Fixtures usan datos y servicios sintéticos.

## Instalación y datos

- Entrada instalada: `~/.opencode/bin/opencode` → Node 22.23.2 →
  `~/.config/opencode/production-v2/entry.mjs`; devuelve `opencode v2.2.7`.
- `activation-complete.json`: `installed-and-verified`; `active.json` concuerda.
  La imagen/hash de la entrada coincide con el recibo final.
- `officialRuntime` verificó el binario oficial por SHA-256, sin upgrade/parche.
- Store activo separado: `/mnt/hd_linux/opencode-cutover-final-20261118/production-storage`.
  Publicación, permisos privados y binding comprobados por el launcher.
- Evidencia conservada del corte: 1402 sesiones originales + 6 del piloto = 1408;
  migración/transferencia nativas verificadas, auth por pipe. Es evidencia del corte,
  **no un nuevo recuento exhaustivo ni comparación de todas las conversaciones**.
- Atribución nativa de esta sesión ejecutada: `completeHistory:true`, 4102 filas de
  metadata almacenada enumeradas. Comprueba transporte real, no sólo el contexto
  visible ni una garantía universal de migración.
- 3451 preimages de rollback verificadas por el módulo propietario; 3451 postimages
  selladas coinciden con la instalación actual, sin diferencias. No se ejecutó rollback.
- Espacio observado: ~26,76 GiB libres en `/home`; ~184,84 GiB en `/mnt/hd_linux`.
  La operación depende de ese volumen montado y de las rutas actuales del runtime,
  perfiles y fuentes Core/AUNE. No es una instalación portable/autocontenida.

## Canónicos Git

19 repos del harness: raíces físicas correctas, HEAD válido, sin entradas unmerged;
`git fsck --connectivity-only --no-dangling` terminó correctamente en los 19.
Todos en `main`, con 0/0 respecto de sus refs upstream **locales**. No hubo fetch:
esto no certifica que el servidor remoto siga igual.

| Owner | Entradas modificadas/no seguidas | No seguidas |
|---|---:|---:|
| opencode-stack | 223 | 207 |
| knowledge | 29 | 23 |
| ticketing | 37 | 28 |
| codegraph | 31 | 30 |
| documents | 57 | 53 |
| notifier | 18 | 17 |
| github-accounts-local | 16 | 8 |
| AUNE canónico del workspace | 74 | 64 |
| higyrus | 5 | 3 |
| virtual-broker | 2 | 2 |
| keycloak | 2 | 2 |
| higyrus-gateway | 1 | 1 |
| aggregator | 2 | 2 |
| market-data | 1 | 1 |
| perfil-inversor | 1 | 1 |
| documento-api | 1 | 1 |
| oms-api | 1 | 1 |
| byma-importer | 2 | 2 |
| saldo-rt | 7 | 7 |

Base y seis addons machine-local: `~/.local/src/`. AUNE y los once owners:
`~/TRABAJO/AUNE/higyrus-workspace/super-turing-opencode-*`; se usó el AUNE canónico
del workspace, no el clon auxiliar atrasado de `~/.local/src/`.

**Riesgo de reproducción:** esos cambios no son corrupción ni autorizan descartarlos,
pero gran parte de `v2/` y `migrations/v2/` permanece untracked. Un clon limpio no
reproduce esta instalación. La entrada activa además importa fuente Core/AUNE del
working tree. Se requiere revisión/publicación o respaldo explícito de esas fuentes;
no se hicieron commits ni se adoptaron cambios ajenos.

También se verificó metadata Git de los once repos de aplicación: raíces/HEAD/upstream
local válidos y sin conflictos. Higyrus, Virtual Broker, Aggregator, BYMA y saldo
tienen cambios locales; no se interpretaron como errores ni se tocaron. No se hizo
fsck/build/test funcional de las aplicaciones financieras.

## Releases y proyectos

- General: revisión `f1874f3a…`, 234 assets, 7 componentes, 22 roles, 34 comandos.
- Perfil privado: `b993b701…`, 257 assets, 10 componentes, 22 roles, 34 comandos.
  Checksums/archivos/revisiones archivadas verificados por sus APIs de distribución;
  sin journal de distribución pendiente o drift de assets gestionados.
- Los once despliegues: preview del motor propietario con 0 escrituras y 0 retiros
  pendientes; dependencias del payload actual resueltas. Se conservaron los inputs
  de equipo de Aggregator/saldo y los aliases explícitos.
- Diez paquetes regenerables coinciden exactamente con el archivo actual. Virtual
  Broker cambia sólo `manifest.json`: procedencia/`nativeInputs` del `AGENTS.md`
  nativo actual. Sus archivos ejecutables y aliases coinciden; no se clasificó ese
  cambio de procedencia como pérdida funcional ni se repaquetó automáticamente.
- `production-check ... check`: 13 ubicaciones pass (general, workspace y 11 productos),
  usando el descubrimiento nativo `debug config` con storage temporal y sin MCP.
- `production-check ... live`: las mismas 13 ubicaciones listas, `readyForChat:true`,
  proveedor conectado por metadata y 0 hallazgos bloqueantes. Cinco MCP fuera de
  AUNE, seis dentro; Grafana ausente fuera y conectado dentro como corresponde.
- `stack-layer-audit` del host actual: pass, `findings:[]`; prompts globales retenidos
  en los 22 roles y guardas read-only presentes. Son testigos acotados, no aprobación
  semántica universal de permisos o de cada workflow.
- Snapshots/undo conservados: preflights de candidatos sensibles y exclusiones Git
  pasan; pruebas nativas de undo/exclusiones pasan. No es detección universal de
  secretos ni purga de objetos históricos del Git fuente.

## Dependencias y backends

- Playwright administrado: pin/integridad verificados por su preflight; MCP conectado.
  No se abrió navegador ni se modificó una sesión de login.
- Documents: Node/tsx, Artifact Studio, Typst, D2, Quarto, Chromium y ambos entrypoints
  canvas presentes; ocho definiciones de tools, prototipos retirados deshabilitados.
  Tests legacy ejercitan QMD propio, D2 y Typst con recursos sintéticos. No se afirma
  QA visual de nuevos entregables ni publicación real Confluence.
- Engram operativo; doctor sin errores/bloqueos. Warning de siete mutaciones legacy
  de sync en proyecto no enrolado: report-only, no motivo para enrolar/reparar cloud.
- Qdrant/Ollama por wrapper aprobado: status OK, dimensión 1024, doce colecciones
  presentes (global, AUNE, varios productos e histórico Higyrus). No hubo indexación,
  búsqueda de cuerpos o cambios de colección; no se presupone corpus de todos los repos.
- Context7 conecta por MCP pero una llamada real a resolve-library-id devolvió
  **Monthly quota exceeded**. Conexión/catalogo no equivale a servicio utilizable.
  Resolver cuota/cuenta o usar documentación pública como fallback explícito.
- Engram y Semgrep actuales existen y son ejecutables en `~/.opencode/bin`;
  Semgrep por ruta absoluta devuelve 1.161.0. Herramientas OS de documentos y
  notificación presentes. Audio/foco/desktop reales no comprobados.

## Fallo funcional: herramientas de patrones de Higyrus

El entorno V2 usa PATH restringido a Node + `/usr/local/bin:/usr/bin:/bin` y no
incluye `~/.opencode/bin`. El runner local busca `semgrep` mediante `command -v`.

Reproducción dentro del shell real de esta sesión, cwd Higyrus, sin escanear código:

```sh
bash .opencode/scripts/semgrep_runner.sh --path .opencode/rules/semgrep --config .opencode/rules/semgrep/integrations-higyrus-api-usage.yml
```

Resultado: exit 1, `Semgrep is not installed.` El binario está instalado: falta el
binding/resolución en este entorno, no una nueva instalación de Semgrep.

Ast-grep: no existe `.opencode/node_modules/.bin/ast-grep` ni `ast-grep` en PATH.
El runner local conserva un fallback `npx -y @ast-grep/cli@latest`. No se ejecutó:
puede descargar un runtime no fijado. Es dependencia local no consolidada, no un
fallo de ejecución ya reproducido ni permiso para instalar automáticamente.

Corrección recomendada: binding explícito de ejecutables administrados en el owner
local de Higyrus y validación de ambos runners desde el entorno V2. No ampliar PATH
a todo HOME, no desactivar guardas ni agregar dominio Higyrus a la base general.

## Pruebas actuales

**285 pass, 0 fail, 0 skip** en los comandos ejecutados:

| Suite | Casos |
|---|---:|
| Core V2 Node (`v2/general/test/*.test.mjs`) | 90 |
| AUNE V2 Node (`v2/test/*.test.mjs`, incluye subtests) | 78 |
| Knowledge/Ticketing/CodeGraph/GitHub-local/Notifier V2 Node | 57 |
| Documents documenter/confluence Node | 19 |
| Cutover Python | 27 |
| Core render Python | 3 |
| AUNE inventory Python | 7 |
| saldo hooks Node | 3 |
| Transferencia nativa final con fixture | 1 |

Los tests de transferencia/rollback mutan sólo fixtures desechables. Los tests
verdes de metadata/fixtures **no cubrían la disponibilidad real de Semgrep por
PATH**: no presentarlos como certificación de todos los comandos instalados.

## Pendientes priorizados

1. Corregir resolución de Semgrep y consolidar el runtime ast-grep de Higyrus;
   probar comandos reales acotados sin descargas implícitas.
2. Resolver la cuota de Context7, sin exponer claves ni cambiar cuenta por reflejo.
3. Consolidar fuentes V2 no versionadas con revisión/autorización de publicación
   o respaldo explícito; no borrar los working trees de los que depende la entrada.
4. Reconciliar documentos `ESTADO-CORTE.md`, `CONTRATO-GESTIONADO.md`, `CORTE-FINAL.md`
   y README AUNE que aún hablan de activación pendiente. El recibo/commit activo
   y la verificación actual prueban que el corte ya se realizó.

Límites conocidos del contrato gestionado siguen vigentes: hosting externo,
standalone/ACP/service/pair y mutadores no integrados no equivalen a CLI universal.
No hubo pruebas de SSH/DB/GitHub/negocio remoto ni validez exhaustiva de credenciales,
rescate de todos los adjuntos externos o ejecución de todos los comandos posibles.
