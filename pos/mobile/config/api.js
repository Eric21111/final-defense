
const PRODUCTION_URL = 'https://pos-hosting-np5d.onrender.com';
const LOCAL_IP = '192.168.56.1';
const LOCALHOST = 'localhost';
const PORT = 5000;
const TIMEOUT = 30000;

const normalizeBaseUrl = (url) => (url || '').replace(/\/+$/, '');

export const createApiConfig = (host = LOCAL_IP, port = PORT, protocol = 'http') => {
  const baseUrl = normalizeBaseUrl(`${protocol}://${host}:${port}`);
  return {
    BASE_URL: baseUrl,
    API_URL: `${baseUrl}/api`,
    IP: host,
    PORT: port,
    TIMEOUT,
  };
};

const getDevBaseUrl = () => {
  const envBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  if (envBaseUrl) return envBaseUrl;

  // On Expo Web, default to the browser host so localhost works out of the box.
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname || LOCALHOST;
    return `http://${host}:${PORT}`;
  }

  // On native devices, keep using LAN IP for phone -> local backend access.
  return `http://${LOCAL_IP}:${PORT}`;
};

const API_BASE_URL = normalizeBaseUrl(__DEV__ ? getDevBaseUrl() : PRODUCTION_URL);
export const API_URL = `${API_BASE_URL}/api`;

export default {
  BASE_URL: API_BASE_URL,
  API_URL,
  IP: LOCAL_IP,
  PORT,
  TIMEOUT,
};