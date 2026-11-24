# Atribución desde el historial nativo

`agent_attribution` consulta páginas almacenadas de la sesión actual mediante
la API pública. Devuelve metadata de agentes/modelos; no lee directamente DBs,
no reconstruye cuerpos y no usa una sesión ajena como fallback. Si no hay
suficiente cobertura o no se dispone del transporte gestionado, el resultado
no certifica historia completa. Mensajes eliminados, externos o sin metadata
no se inventan.

El [host gestionado](../CONTRATO-GESTIONADO.md) entrega la conexión autenticada al
plugin por descriptor de archivo efímero. No se usa un archivo de credenciales
ni se incluye la conexión en la salida de la herramienta. El transporte se
comparte con las integraciones aprobadas sin cambiar sus permisos.

Pruebas: `node --test v2/general/test/identity*.test.mjs`. Las pruebas nativas
usan datos sintéticos para comprobar paginación, cambios de agente y compactación.
