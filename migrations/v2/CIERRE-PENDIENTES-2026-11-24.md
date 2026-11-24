# Cierre posible de pendientes — 2026-11-24

## Resultado

General, AUNE y once proyectos permanecen aplicados; offline 13/13 y última
pasada live 13/13 listos. Se corrigió la brecha de readiness del catálogo MCP,
sin cambios de permisos, credenciales, modelos elegidos, runtime, DB o aplicaciones.
No es un certificado funcional de todo el stack ni de la notebook inaccesible.

## Rovo: corrección del launcher, no del servicio remoto

Antes de esta pasada volvió a observarse 10/13 live, con tools Rovo ausentes en
Keycloak y Market Data pese a Connected. Arranques individuales posteriores no
lo reprodujeron. El código confirmaba conexión pero muestreaba el registro una
sola vez, sin esperar su readiness separada.

Se añadió espera acotada sólo para `managed-tool-missing` de servidores conocidos,
habilitados y Connected. El presupuesto no se reinicia; errores de permisos o
prompts, servers fallidos/deshabilitados y fallos nativos no se ocultan. Si el
catálogo sigue incompleto al vencer el plazo, el arranque sigue bloqueado.
Una sola sesión diagnóstica propia, nonces nuevos, receipts propios retirados;
cero inferencias, consultas de negocio, OAuth nuevo o publicaciones remotas.

Evidencia: fixture de API pública falló antes y pasó después; deadline y errores
persistentes siguen fallando cerrado. **93 Core + 79 AUNE pass**. La pasada live
posterior dio **13/13**, con una muestra por ubicación. Por eso no se afirma que
se haya reproducido/corregido la causa interna del servidor remoto; sí se cubrió
la transición de readiness que el launcher no contemplaba.

## Higyrus: integrado, dos scripts todavía pendientes de aplicar

Los once proyectos, incluido Higyrus, tienen despliegue V2 aplicado e íntegro.
No quedó todo Higyrus fuera. Lo pendiente es reemplazar dos runners antiguos:
Semgrep aún no usa su binding explícito y ast-grep aún conserva `npx latest`.
Bindings instalados y fuentes corregidas/publicadas; smoke sintético anterior
pasó con los ejecutables reales. No se vuelve a afirmar que esos runners ya estén
desplegados o probados desde la aplicación.

Paquete sucesor verificado:

```text
~/.local/share/opencode-stack/pending/higyrus-tools-20261119
34b13ac4c332d0dbde40f40d1035f7920b666ffa684ae5dd6049f65c5d0dea2e
```

Preflight de hoy: exactamente dos writes, cero removes, preimages iguales al
archivo desplegado anterior. **No aplicado: el padre conserva un reader abierto,
incluida la sesión desde la que se trabaja.** No se borraron leases, mataron
clientes ni creó un watcher oculto para hacer el cambio por detrás.

### Continuación ejecutable en esta PC

Cerrar los clientes OpenCode que usan ese padre. Desde una terminal normal y el
owner AUNE canónico actualizado:

```sh
node /home/jmagnaterra/TRABAJO/AUNE/higyrus-workspace/super-turing-opencode-aune/v2/projects/deploy.mjs apply \
  --package /home/jmagnaterra/.local/share/opencode-stack/pending/higyrus-tools-20261119 \
  --project /home/jmagnaterra/TRABAJO/AUNE/higyrus-workspace/higyrus \
  --client-closed --confirm --upgrade-sources
```

El motor vuelve a verificar guards/preimages y conserva receipts/rollback.
Si encuentra otro reader o drift, detenerse; no quitar el lock. Tras aplicar,
verificar hashes de ambos scripts y `production-check ... check/live`. Las rutas
anteriores son exclusivas de esta máquina, no instrucciones para la notebook.

## Lo que sigue fuera de este cierre

- Context7: última consulta de esta sesión, cuota agotada. No hay cambio de cuenta,
  compra de cuota o nuevas credenciales autorizadas/proporcionadas para resolverla.
- Notebook antigua: el updater y diagnóstico local están publicados, pero no se
  ejecutaron en esa notebook. Layouts Background administrados/JSON desconocidos
  siguen requiriendo migración local oficial en copia. Ver `v2/install/NOTEBOOK.md`.
- Background/Stitch son exclusiones deliberadas del perfil V2. Hosting externo,
  standalone/service/ACP/pair no equivalen al contrato gestionado disponible.
- No se hicieron builds/pruebas funcionales de aplicaciones, indexación de corpus
  o CodeGraph ni restauración/reescritura de historiales.

La publicación de fuentes se verifica aparte del despliegue: un push no aplica
los dos scripts de Higyrus mientras el padre esté ocupado.
