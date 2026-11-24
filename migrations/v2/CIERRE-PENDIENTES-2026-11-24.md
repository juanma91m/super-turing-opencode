# Cierre posible de pendientes — 2026-11-24

**Actualización posterior:** los dos runners de Higyrus ya se aplicaron en la PC
auditada. Se verificó que ambos coinciden con el overlay canónico, que el paquete
no tiene escrituras ni retiros pendientes y que pasa el chequeo nativo offline
del proyecto. El usuario también confirmó que instaló V2 en su notebook y que
arrancó correctamente. Eso no es una auditoría del historial de esa máquina ni
amplía la compatibilidad del updater a layouts antiguos desconocidos.

## Resultado

General, AUNE y once proyectos permanecen aplicados; offline 13/13 y última
pasada live 13/13 listos. Se corrigió la brecha de readiness del catálogo MCP,
sin cambios de permisos, credenciales, modelos elegidos, runtime, DB o aplicaciones.
No es un certificado funcional de todo el stack ni una verificación independiente
de la notebook.

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

## Higyrus: registro histórico del despliegue de los dos scripts

Al auditar inicialmente, los once proyectos, incluido Higyrus, ya tenían el
overlay V2 aplicado. Sólo faltaba reemplazar dos runners antiguos: Semgrep no
usaba su binding explícito y ast-grep conservaba `npx latest`. El smoke con los
ejecutables reales usó datos sintéticos, no código de aplicación.

Paquete sucesor verificado:

```text
~/.local/share/opencode-stack/pending/higyrus-tools-20261119
34b13ac4c332d0dbde40f40d1035f7920b666ffa684ae5dd6049f65c5d0dea2e
```

El preflight inicial informaba exactamente dos escrituras, cero retiros y
preimages iguales al paquete anterior. No se aplicó mientras el padre tenía un
lector abierto; se esperó el cierre normal de los clientes.

### Comando aplicado en esta PC (no repetir)

Una vez cerrados los clientes de OpenCode que usaban el padre, desde una
terminal normal se ejecutó el comando del owner AUNE canónico:

```sh
node /home/jmagnaterra/TRABAJO/AUNE/higyrus-workspace/super-turing-opencode-aune/v2/projects/deploy.mjs apply \
  --package /home/jmagnaterra/.local/share/opencode-stack/pending/higyrus-tools-20261119 \
  --project /home/jmagnaterra/TRABAJO/AUNE/higyrus-workspace/higyrus \
  --client-closed --confirm --upgrade-sources
```

El motor verifica las guardas y los preimages, y conserva recibos y rollback.
El resultado fue `applied`, con dos archivos cambiados, sin modificar runtime ni
almacenamiento. Se comprobaron los bytes de ambos scripts y el chequeo offline.
Las rutas anteriores son de esta máquina, no instrucciones para la notebook.

## Límites y exclusiones

- Context7: última consulta de esta sesión, cuota agotada. No hay cambio de cuenta,
  compra de cuota o nuevas credenciales autorizadas/proporcionadas para resolverla.
- Notebook: instalación reportada exitosa por el usuario, sin validación
  independiente de datos o layouts. Background administrado e historial JSON
  desconocido siguen requiriendo migración local oficial en copia. Ver
  `v2/install/NOTEBOOK.md`.
- Background/Stitch son exclusiones deliberadas del perfil V2. Hosting externo,
  standalone/service/ACP/pair no equivalen al contrato gestionado disponible.
- No se hicieron builds/pruebas funcionales de aplicaciones, indexación de corpus
  o CodeGraph ni restauración/reescritura de historiales.

La publicación de fuentes se verifica aparte del despliegue: un push no aplica
archivos ni elude los lectores del perfil.
