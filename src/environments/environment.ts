import { ensureSecureProtocol } from '../app/core/utils/url.utils';

const API_BASE_URL = ensureSecureProtocol('https://api-accura.azurewebsites.net/');
const NOTIFICATIONS_WS_URL = ensureSecureProtocol('wss://api-accura.azurewebsites.net/notifications/ws');

// const API_BASE_URL = ensureSecureProtocol('http://127.0.0.1:8000');
// const NOTIFICATIONS_WS_URL = ensureSecureProtocol('http://127.0.0.1:8000/notifications/ws');

export const environment = {
  production: true,
  apiBaseUrl: API_BASE_URL,
  notificationsWsUrl: NOTIFICATIONS_WS_URL
};
