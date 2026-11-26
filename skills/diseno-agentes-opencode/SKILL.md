---
name: diseno-agentes-opencode
description: Define criterios para crear o ajustar agentes, skills, comandos, prompts y permisos de OpenCode con cambios chicos y consistentes.
compatibility: opencode
---
## Que hago
- Ayudo a decidir si algo debe resolverse con un agente, una skill, un comando o solo documentacion.
- Reviso permisos, limites, prompts y responsabilidades para que cada pieza tenga un rol claro.
- Refuerzo consistencia entre configuracion, agentes, skills, comandos y documentacion.

## Cuando usarme
- Antes de crear o cambiar agentes de OpenCode.
- Cuando hay drift entre configuracion y documentacion.
- Cuando aparece una nueva necesidad y no esta claro si merece un agente nuevo o una solucion mas chica.

## Criterios base
- Preferir cambios pequeños, trazables y reversibles.
- No expandir permisos sin una razon clara.
- Mantener responsabilidades bien delimitadas.
- No mezclar dominio o reglas especificas de un proyecto dentro de agentes, skills o prompts genericos globales.
- Validar la configuracion resultante y actualizar la documentacion afectada cuando corresponda.

## Cuándo recomendar una comparación A/B

- Proponela si el cambio puede alterar un comportamiento observado (calidad, omisiones, correcciones o costo de exploración) y ese resultado ayudaría a decidir si adoptarlo. Aplica a prompts, modelos, herramientas, addons o runtimes; CodeGraph es un ejemplo, no un requisito.
- No la hagas por rutina. Para cambios de documentación, configuración declarativa o guardas deterministas, preferí el chequeo directo que corresponda. Un A/B no reemplaza probar permisos con casos permitidos y denegados, ni validar la configuración nativa.
- Fijá baseline y candidato, tarea, rúbrica y presupuesto antes de correr. Mantené el mismo código, contexto inicial y condiciones salvo el cambio evaluado. Usá sesiones independientes y, si podés, evaluá sin saber qué variante respondió. Mirá primero calidad y correcciones; después tiempo, tokens y herramientas. Si cambiaron varias piezas, atribuile el resultado al conjunto, no a una sola. Un par es una señal inicial, no una conclusión general.
- En el checkout de Core, `node v2/tools/stack-ab.mjs prepare` muestra el plan del piloto sintético sin abrir un host. El runner actual valida el mecanismo con un proveedor simulado; no evalúa calidad real ni forma parte del perfil activo. Recomendá el piloto o una comparación real acotada, pero no lances corridas, inferencia, indexación ni cambios de permisos sin autorización explícita.
