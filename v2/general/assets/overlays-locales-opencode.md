---
name: overlays-locales-opencode
description: Diseña o audita capas locales nativas V2 con contexto aditivo, deltas mínimos y permisos seguros; no asumir herencia completa por mismo nombre.
compatibility: opencode
---

## Decisión mínima

- Contexto, dominio, entry points, stack y fuentes: `AGENTS.md` del proyecto.
- Reglas de organización: addon propietario opt-in, no la base reusable.
- Si cambia ejecución, proponer un delta nativo de modelo/modo/`permissions` en la
  configuración local existente; evitar `system` o archivos completos del mismo
  nombre. Nuevos roles requieren definición completa y revisión explícita.
- Comandos/helpers/skills propios sólo si son necesarios, con alcance local.

## Preservar autoridad y contratos

No hay herencia completa automática entre archivos global/local. Los deltas sin
`system` conservaron el cuerpo en los fixtures del pin 2.2.7; validar la cadena real.
Preservar responsabilidades, skills útiles, formatos y guardas. Todo recorte o
ampliación necesita motivo y aprobación. No reinyectar `tools`, aliases V1 o sentinel
`__replace__`: no pertenecen al contrato nativo. Guards de shell/targets/tools son
otra capa y no se sustituyen con un allow de proyecto/sesión. Extensiones precisan
integración revisada en el owner; nunca romper un guard para pasar el bootstrap.

## Flujo

1. Leer configuración/documentación pública y trabajo existente; no `.env`/auth.
2. `/check-local-overlays` o `/stack-doctor` → `stack-layer-audit`: fuentes actuales,
   registro efectivo, permisos por testigos, catálogo y warnings. No imprimir config
   resuelta/prompts ni confundir presencia con revisión semántica.
3. Preferir propuesta mínima con `stack-layer-scaffold`; devuelve JSON y revisión,
   no escribe. Ver `LOCAL-OVERLAY-TEMPLATE.md` y `PLAYBOOK-LOCAL-OVERLAYS.md` nativos.
4. Pedir confirmación antes de aplicar mediante edición deliberada, preservar campos
   ajenos/JSONC y validar en entorno autorizado; reiniciar cliente tras cambios.

No autosync, indexación CodeGraph, credenciales nuevas ni adopción de handoff por
diagnosticar. `debug agents` inicia MCP en 2.2.7: no usarlo como lectura inocua. El
auditor redescubre fuentes con `debug config` y storage temporal, no prueba que no
cambiaron desde el arranque ni aprueba toda la jerarquía real por sí solo.
