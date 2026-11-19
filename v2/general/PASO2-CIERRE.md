# Paso 2 — general preparado y arranque real verificado

## Resultado

**Paso2 técnico cerrado en alcance candidato general**, no corte productivo ni
aceptación de capas privadas/proyectos o de todas las operaciones de negocio.
El usuario reiteró que **Stitch NO va en V2** y autorizó el resto de la ventana.
Se corrigió su reintroducción errónea; V1 y workshop no se modificaron.

-7 aportes/5 MCP/22 roles/33 skills propias/34 comandos/7 registros/227 assets.
- Runtime durable Playwright0.0.85 preparado offline,546 entradas/404912446 bytes,
  Chromium1217 original, sin descargas/perfiles/cambios a caches fuente.
- Candidato instalado en `~/.local/share/opencode-v2-clean/general-composed-candidate`.
  Revisión994baceb28080a8e11e02db5231022b908e65cc388eb4edd0c882a02b46fb683,
  anterior50656cd883efcc226c0c89cd487de736354cbbc6c93fa5e677af974b990a1205.
- `check`: ready-assets, sin drift/faltantes/config extra. release-plan coincide
  con revisión instalada, delta0. No installer V1, PATH/binario/config global cambiados.
- `verify-live --candidate-only --client-closed --reuse-v2-storage` real:
  ready:true,readyForChat:true,auditStatus:pass,findings:[]; Rovo,CodeGraph,Context7,
  Engram y Playwright connected. Proveedor conectado por metadata.22 roles/34
  comandos,36 skills registradas totales/149 tools en registro (no grants universales).
-0 inferencias/llamadas de negocio del launcher. Sólo SDK/startup/catálogos/metadata,
  data/state nativos del piloto V2 reutilizados con autorización; config/HOME/cache
  propios. Sesión diagnóstica/recibo/host/lease propios retirados. No DB V1, copia de
  auth, páginas/generaciones/publicaciones/SQL/SSH o importación de sesiones.

## Exclusión Stitch, no cambio V1

Sin componente/selector/plugin/MCP/headers/key/allow en V2; excepción de referencias
de key en releases retirada y catálogo de distribución vuelve a excluirlo junto
con Background. Policies niegan namespace Stitch. No se leyó/copió su clave real.
Roles e instrucciones emitidos ya no recomiendan su uso. Skill combinada adaptada
a `playwright-ui-opencode`, conservando sólo el contenido Playwright; sources V1
intactos. La reintroducción anterior fue un error del agente, no una aprobación.

## Incompatibilidad real resuelta

Primer verify-live no se declaró listo: managed-tool-missing para executeRead
Confluence aunque los5 MCP conectaban. Se consultaron **sólo definiciones**, usando
el helper existente con modo reference-structural;0 tools/modelo/páginas.
Artefacto metadata SHA e4c18fb688831bcaea6e69a8170757ab8692315bb9ea3234df769ba4317aeacf.

La firma real incluye name(min1/max512),cloudId,inputs con additionalProperties:{},
y responseFields/view opcionales; sólo name requerido. El matcher anterior rechazaba
esos campos opcionales. Ahora acepta esa firma, pero el cliente sigue enviando sólo
guía-create/guía-update/espacio por sus3 campos fijos. No expone selectores libres,
otros métodos o nuevos permisos. Referencias directas getContentFormatGuide/
getConfluenceSpace no estaban registradas: se conserva el mismo executeRead nativo.

Tests, actualización versionada y segundo verify-live OK. **Definición/registro
compatibles no certifican respuestas/guía/espacio/publicación reales**, que no se
invocaron. Writes siguen las dos tools V1 Doc ask, sin protocolo inventado.

## Contraste de superficies

| Superficie | Conservación/adaptación y evidencia |
|---|---|
| Roles/delegación | Prompt/modelo/targets/read-only y builtin hidden preservados; native subagent sin addon Background. No aceptación de overlays por conteo |
| Comandos/helpers |34 comandos/7 registros, scripts canónicos; sesiones por API no SQL V1, HOME/bindings seleccionados. Privados/GitHub conservan su owner posterior |
| Libpq | Autenticación existente PGSSL*/Kerberos/PGPASSWORD sólo desde servidor seleccionado al helper literal psql-readonly por hook; shell genérica/TUI/config/argv no reciben el binding. psql falso prueba READ ONLY; permisos wrapper V1 se conservan. No sandbox de plugins/MCP/SDK/same UID ni DB real probada |
| Knowledge/Ticketing | Wrappers/overrides opacos, autonomía/autoridad, ACL y naming conservados; sin semillas de ensayo o Jira real |
| Documents |8 tools locales originales,3 programas QMD/D2/Typst idénticos y comandos sin agent forzado; edit/destinos V1. Prototipos estáticos/ODT derivado sólo opt-in históricos, no política general |
| Notifier | Backend/preferences V1 restaurados; básico ya aprobado, quiet hours/sonido/foco con mocks y PTY. Audio/foco avanzados reales aún no certificados |
| Defaults/historia | D05 aprobado,7 modelos Ollama dormidos, D02 benchmark y D06 atribución almacenada. No equiparar D06 a migrar V1 íntegro |
| Distribución | Pin2.2.7, runtime durable y config versionada candidata; update/rollback/recovery probados. Rollback config no restaura DB/runtimes/negocio |

## Regresiones

75 Node+3 Python general,100 migración/41 composición reejecutados OK;22 Node+45
Python Documents,14 Node+57 Python CodeGraph(56 OK/1 skip). Suite de owners anterior
sin cambios: Ticketing10 Node/4 Python,Notifier18 Node,Knowledge7 Node/8 Python.
29 casos base y7 Python runtime+7 calls headless en copia pública temporal ya OK.
Tests nativos no prueban calidad semántica universal o historial perdido/externo.

## Siguiente paso y límites

Paso3: AUNE y owners privados en sus repos, luego11 overlays bajo gate efectivo
general→organización→proyecto. No abrir esos repos como migrados por este candidato
general-only. D01 historial íntegro/backup/restore/preservación de sesiones piloto,
salida del ownership Background V1 y corte autorizado siguen obligatorios después.
No se dio por suficiente un archivo de texto/backup para el requisito de historial.

Uso futuro neutral (cerrar otros clientes V2 que comparten el store):

```text
node ~/.local/src/opencode-stack/migrations/v2/general-composed.mjs chat --project /tmp/opencode --candidate-only --client-closed --reuse-v2-storage
```

No reabre sesiones anteriores automáticamente. readyForChat verifica startup y
metadata, no prueba inferencia/refresh futuro del proveedor ni publica nada.
