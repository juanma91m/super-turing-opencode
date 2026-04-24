# Playbook Async OpenCode

Guía práctica para usar la delegación async global configurada en `~/.config/opencode/`.

## 1. Cuándo usar cada tool

| Tool | Uso | Reglas principales |
|---|---|---|
| `delegate(prompt, agent)` | investigación, inspección, review o diseño read-only | solo agentes read-only, matriz de permisos, nested máximo 1 nivel secundario |
| `delegate_isolated(prompt, agent, name?)` | implementación write-capable paralela en worktree aislado | solo `master-dev`, sin auto-merge, queda en `review_pending` |
| `delegation_read(id)` | leer resultado completo persistido | usar cuando ya llegó la notificación o al retomar contexto |
| `delegation_accept(id)` | aceptar una delegación aislada | solo `master-dev`, requiere `review_pending`, conserva worktree |
| `delegation_apply(id)` | aplicar una delegación aceptada al workspace principal | solo `master-dev`, requiere `accepted`, workspace principal limpio, no hace commit |
| `delegation_discard(id)` | descartar una delegación aislada | solo `master-dev`, preserva artifacts y elimina worktree |

## 2. Regla de oro para `delegate`

Siempre mandar un **task packet explícito**:

- objetivo
- por qué
- alcance
- hechos relevantes
- rutas exactas
- referencias de memoria si aplican
- formato esperado
- output budget chico

### Ejemplo mínimo

```text
Use delegate with explorer.

Task packet:
- Objective: confirm X in official docs.
- Why: we need to decide Y now.
- Scope: only docs for X, no comparisons.
- Relevant facts: current implementation uses Z.
- Paths: /repo/path/file.ts
- Expected output: max 4 bullets, include source URLs.
```

## 3. Nested read-only

Permitido cuando aporta foco real.

Casos típicos:

- `frontend-web-developer -> explorer`
- `backend-java-developer -> explorer`
- `backend-java-developer -> code-inspector`
- `reviewer -> code-inspector`

No asumir que una cadena más profunda va a funcionar.
El segundo nivel ya no debe seguir delegando.

## 4. Flujo write-capable aislado

### Paso 1: lanzar

Usar `delegate_isolated(prompt, agent, name?)` desde `master-dev`.

### Paso 2: revisar

Esperar `review_pending` y mirar:

- `delegation_read(id)`
- `diff.patch`
- `changed-files.json`
- `git-status.txt`

### Paso 3A: aceptar sin aplicar todavía

Usar `delegation_accept(id)`.

Resultado:

- estado `accepted`
- worktree queda vivo
- artifacts quedan intactos

### Paso 3B: aplicar al workspace principal

Usar `delegation_apply(id)` solo si:

- ya está `accepted`
- el workspace principal está limpio
- ya revisaste el diff

Resultado:

- estado `applied`
- el diff se aplica sin commit
- el workspace principal queda con cambios unstaged
- el worktree aislado se intenta limpiar

### Paso 3C: descartar

Usar `delegation_discard(id)`.

Resultado:

- estado `discarded`
- artifacts preservados
- worktree eliminado

## 5. Qué revisar antes de `delegation_apply`

- que el cambio siga siendo deseable
- que el diff solo toque lo esperado
- que el workspace principal no tenga cambios locales
- que no haya desvíos de alcance

## 6. Límites actuales importantes

- `delegate_isolated` no hace merge automático
- `delegation_apply` no hace commit
- la sesión hija aislada tiene `bash` deshabilitado por defecto para evitar bloqueos por permisos `ask`
- si necesitás validación shell dentro del worktree aislado, hoy conviene revisar/aplicar manualmente o diseñar una variante explícita después

## 7. Artefacts persistidos de una delegación aislada

- `meta.json`
- `result.md`
- `changed-files.json`
- `git-status.txt`
- `diff.patch`
- `worktree.json`
- `<id>.md` con resumen legible

## 8. Errores comunes

### `delegate` falló por política

Causas típicas:

- target no permitido para ese caller
- target write-capable
- cadena más profunda de lo permitido

### `delegation_apply` falló

Causas típicas:

- delegación no aceptada
- workspace principal sucio
- patch no aplicable limpio

## 9. Recomendación práctica

Para cambios importantes:

1. `delegate_isolated`
2. `delegation_read`
3. `delegation_accept`
4. revisar una vez más el repo principal
5. `delegation_apply`
6. recién después decidir si querés stage/commit manual
