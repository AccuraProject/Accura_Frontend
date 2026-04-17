export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';

  const d = new Date(date);
  
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(date: string | Date | null | undefined): string {
  if (!date) return '';

  const d = new Date(date);
  
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

