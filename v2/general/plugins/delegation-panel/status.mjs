export function delegationStatus({ permission, form, status, terminal }) {
  if (permission) return 'Espera permiso';
  if (form) return 'Espera respuesta';
  if (status === 'running') return 'En ejecución';
  if (terminal === 'succeeded') return 'Terminó';
  if (terminal === 'failed') return 'Falló';
  if (terminal === 'interrupted') return 'Interrumpida';
  return 'Sin ejecución activa';
}
