# Context7 — conexión y cuota son cosas distintas

La auditoría 2026-11-19 confirmó MCP conectado y catálogo disponible, pero una
consulta real devolvió `Monthly quota exceeded`. No es un defecto de instalación
ni se arregla reinstalando el stack. El error no habilita imprimir/copiar claves,
crear otra cuenta, comprar cuota o cambiar silenciosamente el endpoint.

Usar el servicio mientras tenga cuota. Ante ese error, no insistir con reintentos:
declarar que no aportó documentación y consultar la documentación oficial pública
del proveedor por webfetch. Mantener versión/fuentes e incertidumbres explícitas.
Resolver la cuota o una API key requiere el mecanismo de autenticación local
aprobado y disponibilidad de la cuenta; no hay credenciales nuevas en este repo.
