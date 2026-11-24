# Proveedores deshabilitados

La base no registra un proveedor local por defecto. En perfiles compuestos, un
owner puede declarar definiciones Ollama deshabilitadas y ligadas a la máquina.
El builder valida paquete, endpoint loopback, modelos y campos admitidos. No
copia secretos, resuelve referencias ni permite paquetes o proxies arbitrarios.

En 2.2.7, una regla `provider.use` con `deny` impide seleccionar un modelo pero
no alcanza para impedir el descubrimiento del plugin integrado de Ollama. El
perfil también incluye `-opencode.provider.ollama` y la política `plugin.use`
que lo deshabilita. Una definición retenida no habilita modelos, descargas ni
inferencias. El mantenimiento archiva definiciones y denies con la revisión del
perfil, sin regenerar una revisión anterior desde la configuración actual.

Ver `v2/general/test/dormant-providers.test.mjs` para pruebas de forma, políticas
y comportamiento contra fixtures sin credenciales reales.
