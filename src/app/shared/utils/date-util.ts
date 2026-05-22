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

export function parseDateString(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;

  const dateStr = date.trim();

  const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2})\s*(a\. m\.|p\. m\.))?$/i;
  const match = dateStr.match(regex);

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    let hours = 0;
    let minutes = 0;

    if (match[4] && match[5]) {
      hours = Number(match[4]);
      minutes = Number(match[5]);
      const ampm = match[6]?.toLowerCase();

      if (ampm === 'p. m.' && hours < 12) hours += 12;
      if (ampm === 'a. m.' && hours === 12) hours = 0;
    }

    return new Date(year, month, day, hours, minutes);
  }

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
