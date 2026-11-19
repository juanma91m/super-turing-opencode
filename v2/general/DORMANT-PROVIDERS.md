# Proveedores dormidos — preservación nativa sin activación

## Estado

Las **siete definiciones Ollama** seleccionadas de V1 ya se traducen al plan V2,
manteniendo IDs/tags, nombres y endpoint. V1 no cambió. El candidato real continúa
not-distributed/not-prepared y el historial vacío: no se instalaron estas definiciones
ni se inició un host contra los stores originales. No se contactó al Ollama real.

La prueba nativa usa un servidor loopback propio, nunca el puerto del servicio del
operador. Se preservan declaraciones, **no se habilitan modelos ni se certifica
inferencia**. El proveedor principal y title/summary/compaction no cambian.

## Traducción cerrada

`readGeneralDefaults` lee el JSON público de wiring sin resolver referencias y
devuelve reporte allowlisted, selección de mantenimiento y bundle dormido. El CLI
de diagnóstico sólo muestra counts/formas/tipos conocidos; no endpoints, nombres
de modelos, valores de opciones o campos desconocidos.

En la fuente observada los siete modelos sólo declaran `name`. El mapper conserva
exactamente esa información y las claves, incluidos tags con `:`. No inventa
limit/context/cost, capacidades, aliases, variants, settings o valores inferidos.

| V1 | Nativo V2 |
|---|---|
| provider.<id> | providers.<id> |
| npm: @ai-sdk/openai-compatible | package: @opencode/ai/providers/openai-compatible |
| options.baseURL | settings.baseURL, mismo valor seleccionado |
| models.<id>.name | models.<id>.name, sin renombrar ID/tag |
| disabled_providers | denegación explícita provider.use y discovery bloqueado |

Sólo se admite el paquete compatible revisado ya incluido en el runtime oficial,
URL literal loopback `/v1` sin auth/query/fragment y modelos explícitos acotados con
nombre opcional. Provider activo/reservado, paquetes nuevos, headers/env/secrets,
refs/interpolación, proxy remoto o campos no mapeados fallan sin copiar o omitirlos.
Otro formato requiere una traducción deliberada, no un passthrough genérico.

Los labels y bindings permanecen en el plan/configuración machine-bound, no en
diccionarios hardcodeados del stack reusable ni en memoria curada. No hay npx,
instalación de modelos, package upgrade, auth copiada o lectura de credential stores.

## Hallazgo del pin: policy de uso no basta para evitar discovery

En **2.2.7**, `provider.use:deny` excluye modelos y bloquea selección/inferencia,
pero `opencode.provider.ollama` igualmente hace discovery. El control negativo lo
reproduce con al menos una consulta de metadata al loopback del fixture y cero
inferencias/fallback; no se aplicó a configuración instalada o al servicio real.

Por eso el candidato OpenAI-only impide discovery Ollama implícito desde la base,
incluso si no importa ninguna definición:

- policy explícita `provider.use` deny para los IDs dormidos;
- flag nativa `-opencode.provider.ollama`;
- policy global `plugin.use` deny para ese builtin.

Los aportes no pueden sobrescribir definiciones preservadas, revivir el proveedor
o relajar discovery. Un allow local no puede levantar la denegación global, probado
con config de proyecto nativa en el fixture. Las definiciones se mantienen también
al componer el proveedor mock: no hay sustitución accidental del mapa `providers`.

El launcher comprueba que plugins desactivados no estén activos y que ningún
proveedor declarado denegado aparezca en el catálogo utilizable antes de chat.
No es sandbox de red ni override de una autoridad nativa superior. Si el runtime
presenta estado inesperado, se detiene; no conecta ni reconfigura por iniciativa.

Esto desactiva **el proveedor de modelos/discovery de OpenCode**, no el servicio
Ollama ni los helpers HTTP de embeddings de Knowledge. No modifica sus settings,
backends, modelos o procesos. No se ejecutó serve/pull/stop, Docker o systemd.

Habilitarlo más adelante requiere una decisión explícita y revisar todos estos
controles y compatibilidad/limits/capabilities nativos. No se afirma que quitar un
deny equivalga por sí solo a paridad de inferencia con V1.

## Releases y evidencia

Las declaraciones y denegaciones están en el opencode.json gestionado: se verifican,
archivan y restauran con su revisión, sin volver a leer V1 para el boot instalado.
La prueba de update/rollback conserva los siete modelos y el bloqueo de uso/discovery.

- **66 Node +3 Python general**,29 casos base y41 composición pasaron en este
  incremento. Las100 regresiones legacy del hito anterior no se repitieron: no se
  cambiaron sus adapters/workshop ni se necesita otro arranque de sus servicios.
- Schema/API oficial2.2.7: siete modelos en fuente nativa, ninguno utilizable,
  builtin discovery ausente, selección explícita rechazada sin fallback.
- Endpoint propio: **0 requests** con protección aplicada, incluido allow local;
  control negativo sólo discovery, nunca inferencia. No inferencias al mock principal.
- verify-live verifica el estado dormido y no contacta el endpoint. Pure mapper y
  constructor cubren secretos/campos extra/paquetes/endpoints y revival indebido.
- Plan real actual:22 roles/33 skills/31 archivos de comandos/7 registries/5 MCP, siete
  declaraciones dormidas; sólo metadata, sin instalar ni iniciar servicios.

El port de declaraciones dormidas ya no bloquea paso2. Además de la ventana
autorizada para snapshot durable/instalación/verificación real y reuse nativo V2,
siguen las brechas de paridad explícitas D02/D03/D04/D06 de la matriz: no están
excluidas por omisión. Reuse requiere clientes correspondientes cerrados.
No es el corte global: AUNE/once
proyectos, historial/backup/restore y salida Background conservan sus gates.
