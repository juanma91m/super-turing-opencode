# Capas locales — candidato nativo V2 (2.2.7)

Propuesta primero; no es un instalador ni habilita escritura automática.

1. Contexto del repo, stack, fuentes y límites de negocio: `AGENTS.md` local.
2. Organización: addon propietario opt-in; no copiar dominio a la base global.
3. Cambio ejecutable justificado: delta nativo en configuración del proyecto.

Ejemplo de **recorte** para revisar, no plantilla a aplicar ciegamente:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agents": {
    "reviewer": {
      "permissions": [
        { "action": "shell", "resource": "git show *", "effect": "deny" }
      ]
    }
  }
}
```

No declara `system`: el host conserva el cuerpo global en el caso validado por
fixtures. Un archivo `.opencode/agents/reviewer.md` o un `system` explícito puede
reemplazarlo; mismo nombre no significa herencia completa. No hay sentinel
`__replace__`, `tools` ni alias `permission/bash/task` de V1 en este contrato.

Usá `stack-layer-scaffold` como propuesta validada para modelo/modo/permisos de
roles existentes. Revisá cada cambio de autoridad, incluso un recorte; no supongas
que concatenar reglas preserva todos los denies. Guardas adicionales limitan
targets/tools/shell: un allow local no las reemplaza. Nuevos helpers/targets exigen
su integración explícita en el owner, nunca desactivar guards para aceptarlos.

Inspeccioná config JSON/JSONC existente y preservá campos ajenos. Pedí confirmación
antes de editar; luego validar fuentes y registro efectivo en contexto aprobado,
reiniciar cliente y auditar. No sincronizar, indexar, autenticar o acceder a sistemas
externos por generar una capa. Comandos/skills locales necesitan revisión semántica.
