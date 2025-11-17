export function ensureSecureProtocol(url: string): string {
  if (!url) {
    return url;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) {
    return trimmed;
  }

  const isHttpsContext = window.location.protocol === 'https:';
  if (!isHttpsContext) {
    return trimmed;
  }

  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }

  if (trimmed.startsWith('ws://')) {
    return `wss://${trimmed.slice('ws://'.length)}`;
  }

  return trimmed;
}
