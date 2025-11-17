import { ensureSecureProtocol } from '../app/core/utils/url.utils';

const API_BASE_URL = ensureSecureProtocol('https://accura-api.azurewebsites.net/');
const NOTIFICATIONS_WS_URL = ensureSecureProtocol('wss://accura-api.azurewebsites.net/notifications/ws');

export const environment = {
  production: true,
  apiBaseUrl: API_BASE_URL,
  notificationsWsUrl: NOTIFICATIONS_WS_URL
};
