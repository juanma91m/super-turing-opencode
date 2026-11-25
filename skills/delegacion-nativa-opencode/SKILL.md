---
name: delegacion-nativa-opencode
description: Coordina subagentes nativos y revisa trabajo paralelo en worktrees explícitos, sin ampliar permisos ni aplicar cambios automáticamente.
compatibility: opencode
---

## Cuándo usarla

- Si una inspección, una revisión independiente o un trabajo aislado aporta valor. Un encargo simple se resuelve en la sesión principal.
- Usá `subagent` sólo con targets permitidos. Para inspección o revisión, elegí un rol de lectura. No prometas aislamiento de archivos por el solo hecho de delegar.

## Qué enviar al subagente

- **Objetivo y motivo:** qué pregunta debe contestar o qué resultado debe producir.
- **Alcance:** directorio, rutas relevantes, qué puede tocar y qué queda fuera. Si es lectura, indicá expresamente que no debe editar.
- **Contexto:** hechos comprobados y referencias pertinentes, sin copiar secretos ni conversaciones enteras.
- **Entrega:** criterio de aceptación, pruebas permitidas y formato breve. Para una revisión, pedí hallazgos con referencias y verificá los puntos materiales antes de actuar.

Usá el reporte nativo de la sesión hija. Mientras esperás, avanzá sólo en trabajo independiente; no consultes su estado en bucle. Si una hija pide permiso o una respuesta, revisá el pedido en esa sesión: el aviso no concede autoridad. En el launcher gestionado, cerrar la TUI termina su host; reabrir el historial no garantiza que la ejecución siga viva.

## Escritura paralela: worktrees explícitos

Si dos tareas deben escribir en paralelo, usá un worktree Git distinto por tarea, preparado explícitamente por el operador o mediante un flujo ya autorizado. Abrí una sesión en el directorio físico del worktree y comprobá que aplica la configuración y los permisos del proyecto antes de editar. Un worktree separa archivos de trabajo, no aísla secretos o servicios; no compartas índices CodeGraph entre worktrees.

Cada tarea devuelve los archivos modificados, pruebas ejecutadas y riesgos pendientes. Revisá el diff contra la revisión de partida y confirmá que el destino no avanzó ni tiene cambios sin conciliar. Integrá sólo los cambios aprobados; no hagas apply, commit, merge, push ni limpieza automática. Si el aislamiento no está disponible, coordiná las escrituras en serie.

## Seguimiento en la TUI

Desde una sesión, `/tareas-delegadas` (`/bg-tasks`) permite ver y abrir las hijas de su familia si el panel está instalado. Los permisos o preguntas se atienden en la sesión correspondiente; un estado inactivo no prueba éxito. El panel no crea, cancela ni aplica tareas. Si no está disponible, usá la navegación nativa de sesiones.

## Entrega desde un worktree

Pedí este resumen al cerrar una tarea con escritura:

```text
Objetivo y alcance completado:
Worktree (ruta absoluta) y rama:
Base de partida (SHA completo):
Diff contra esa base (incluí cambios sin commit y enumerá archivos nuevos no rastreados):
Archivos y motivo de los cambios:
Pruebas ejecutadas, resultado y qué quedó sin verificar:
Riesgos, dependencias o desvíos de alcance:
Estado: pendiente de revisión (no integrado).
```

Revisar, aprobar e integrar son acciones distintas. Antes de integrar, comprobá que la base y el destino siguen siendo los revisados, que no hay trabajo ajeno sin conciliar y que no se incluyen secretos ni cambios fuera de alcance. No limpiar el worktree como consecuencia de revisar o aprobar.
