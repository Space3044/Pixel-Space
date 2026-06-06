import { forbidden } from './http';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

const isLoopbackOrigin = (url: URL): boolean => LOOPBACK_HOSTS.has(url.hostname);

export const requireSameOrigin = (request: Request): Response | null => {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    if (originUrl.origin === requestUrl.origin) return null;
    if (isLoopbackOrigin(originUrl) && isLoopbackOrigin(requestUrl)) return null;
    return forbidden('invalid_origin');
  } catch {
    return forbidden('invalid_origin');
  }
};
