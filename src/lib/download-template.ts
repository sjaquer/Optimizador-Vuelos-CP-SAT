export async function downloadTemplate() {
  const response = await fetch('/api/download-template');
  if (!response.ok) {
    throw new Error(`No se pudo descargar la plantilla (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_vuelos.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
