# Context7 Tech Catalog for Project Overlays

Esta referencia ayuda a `/init-project-agent-layer` y a humanos a sembrar en `AGENTS.md` local una sección de **fuentes de documentación preferidas** con IDs canónicos de Context7 cuando haya suficiente evidencia.

Es un catálogo **curado pero intencionalmente incompleto**:

- sirve como punto de partida reusable,
- no reemplaza la inspección del repo real,
- no debe inventar IDs para tecnologías dudosas o forks privados,
- puede crecer con evidencia de uso en proyectos reales.

## Objetivo

- reducir fricción al bootstrap de overlays locales,
- dejar documentados IDs canónicos y notas de drift desde el día 1,
- evitar que cada proyecto tenga que resolver siempre las mismas tecnologías comunes,
- mantener fuera de la capa global cualquier detalle privado o específico de un repo concreto.

## Cómo usarlo

Cuando `/init-project-agent-layer` o un humano detecte una tecnología en el repo:

1. inspeccionar manifests y dependencias reales,
2. buscar la tecnología en este catálogo,
3. si el match es confiable, proponerla en `AGENTS.md`,
4. si hay drift de versión o ambigüedad, dejar nota explícita,
5. si no hay match confiable, no inventar ID: dejar follow-up para `explorer` o resolución manual.

## Modelo de confianza

- **high**: se puede proponer directo como ID canónico cuando la tecnología fue detectada con claridad.
- **medium**: se puede proponer, pero con nota visible de drift de versión, cobertura parcial o necesidad de validación.
- **low / none**: no usar como ID canónico por defecto; preferir investigación manual o documentación primaria.

## Reglas de salida para `AGENTS.md`

Cuando el proyecto use librerías o APIs externas relevantes, preferir este esquema:

```md
## Fuentes de documentación preferidas

- Para documentación externa de librerías o APIs públicas, usar **Context7** como primera opción cuando esté disponible.
- Si ya se conoce la librería exacta, la línea de versión o un ID canónico, incluirlo en el prompt para reducir matching ambiguo.

### IDs canónicos de Context7 para <Proyecto>

- **Alta confianza / usar directo cuando aplique**
  - <tecnología>: <id>
- **Usar con cautela por drift de versión en Context7**
  - <tecnología>: <id> _(motivo)_
- **Cuando no haya match confiable en Context7**
  - <tecnología>: preferir código del repo, docs oficiales o investigación puntual con `explorer`
```

## Señales de detección sugeridas

- **Java / Gradle / Maven**: `build.gradle`, `pom.xml`, `gradle.properties`, coordenadas `group:artifact:version`.
- **Node / frontend web**: `package.json`, lockfiles, nombres de paquetes.
- **Python**: `requirements.txt`, `pyproject.toml`, `poetry.lock`.
- **Go / Rust**: `go.mod`, `Cargo.toml`.

Si hay varias majors posibles, mencionar siempre en `AGENTS.md` la **versión real del proyecto** aunque el ID canónico sea genérico.

## Catálogo curado inicial

### Frontend / web

| Tecnología | Señales típicas | ID Context7 | Confianza | Guía de versión | Notas |
| --- | --- | --- | --- | --- | --- |
| React | `react` en `package.json` | `/reactjs/react.dev` | high | mencionar major/minor del proyecto si importa | docs oficiales sólidas |
| Next.js | `next` en `package.json` | `/vercel/next.js` | high | si la versión exacta aparece en Context7, preferir la variante versionada | tiene variants por versión |
| Material UI | `@mui/material`, `@material-ui/core` | `/mui/material-ui` | high | si la major es sensible (v4/v5/v6/v7), mencionarla explícitamente y preferir variante versionada cuando esté disponible | útil para stacks React/MUI |

### Java / backend / APIs

| Tecnología | Señales típicas | ID Context7 | Confianza | Guía de versión | Notas |
| --- | --- | --- | --- | --- | --- |
| Spring Boot | `org.springframework.boot` | `/spring-projects/spring-boot` | high | si Context7 ofrece versión exacta del proyecto, preferirla | buena cobertura y variantes por versión |
| Vaadin 7 | `com.vaadin:vaadin-server` v7.x | `/vaadin/docs/__branch__v7` | high | indicar la minor real del proyecto | útil para stacks server-side Java legacy |
| GWT | `gwt-user`, `gwt-dev` | `/gwtproject/gwt-site` | high | indicar versión real del proyecto | referencia primaria razonable |
| Swagger Core / OpenAPI JAX-RS | `io.swagger.core.v3:swagger-jaxrs2` | `/swagger-api/swagger-core` | high | indicar versión real del artefacto | buen match para anotaciones y setup |
| Swagger UI | `swagger-ui`, webjar equivalente | `/swagger-api/swagger-ui` | high | mencionar versión usada si difiere mucho | útil para UI de documentación |
| JJWT | `io.jsonwebtoken:jjwt` | `/jwtk/jjwt` | high | indicar versión real del proyecto | buena cobertura de parsing/signing |
| Nimbus JOSE JWT | `com.nimbusds:nimbus-jose-jwt` | `/websites/connect2id_products_nimbus-jose-jwt` | high | indicar versión real del proyecto | útil para JOSE/JWT en Java |
| JasperReports | `net.sf.jasperreports:jasperreports` | `/jaspersoft/jasperreports` | high | indicar versión real del proyecto | útil para reporting/exportes |
| Apache POI | `org.apache.poi:poi`, `poi-ooxml` | `/apache/poi` | high | indicar versión real del proyecto | útil para Excel/Office |

### Medium confidence / usar con nota de drift

| Tecnología | Señales típicas | ID Context7 | Confianza | Riesgo principal | Notas |
| --- | --- | --- | --- | --- | --- |
| Spring Security | `org.springframework.security` | `/spring-projects/spring-security` | medium | fuerte sensibilidad a la major | si la versión exacta importa, resolverla explícitamente antes de fijar el ID |
| DataNucleus / JDO | `org.datanucleus:*`, `javax.jdo` | `/websites/datanucleus_version6_0` | medium | Context7 visible hoy más cerca de 6.x que de líneas 5.x legacy | usar más como referencia conceptual que como match exacto |
| Jersey | `org.glassfish.jersey:*` | `/websites/eclipse-ee4j_github_io_jersey_github_io_latest3x` | medium | deriva fácil a 3.x / namespace nuevo | validar cambios de namespace/API |
| Apache PDFBox | `org.apache.pdfbox:pdfbox` | `/apache/pdfbox` | medium | puede haber drift menor de versión | si Context7 ofrece variante exacta, preferirla |
| iText (línea moderna) | `com.itextpdf:*` | `/itext/itext-java` | medium | no cubre bien líneas legacy `com.lowagie` | útil más para conceptos generales que para APIs legacy exactas |

### Low / none / no auto-sembrar como ID canónico

| Tecnología | Señales típicas | Estado | Recomendación |
| --- | --- | --- | --- |
| Apache Axis 1.4 | `org.apache.axis:*` | none | no asumir un ID de Context7; preferir código del repo y docs oficiales |
| JAX-WS legacy / RI antigua | `javax.xml.ws`, dependencias legacy SOAP | none | tratarlo como caso de investigación puntual con `explorer` |
| forks internos / SDK privados | nombres no públicos o propios del repo | none | dejar la fuente local/privada en `AGENTS.md`, no en este catálogo global |

## Criterios de crecimiento del catálogo

Agregar una tecnología nueva solo cuando haya evidencia de que:

- aparece en más de un proyecto o bootstrap relevante,
- el ID canónico ya fue validado manualmente,
- aporta más valor que ruido,
- y la nota de versión/drift es entendible y reusable.
