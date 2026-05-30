import { ensureSecureProtocol } from '../app/core/utils/url.utils';

const API_BASE_URL = ensureSecureProtocol('https://api-accura.azurewebsites.net/');
const NOTIFICATIONS_WS_URL = ensureSecureProtocol('wss://api-accura.azurewebsites.net/notifications/ws');

export const environment = {
  production: false,
  apiBaseUrl: API_BASE_URL,
  notificationsWsUrl: NOTIFICATIONS_WS_URL
};
