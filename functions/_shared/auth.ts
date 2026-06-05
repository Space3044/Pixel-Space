import type { Env } from '../types';

export interface AdminIdentity {
  email: string;
}

const DEV_ADMIN_EMAIL = 'dev@local';

// 身份判定的唯一信号是请求 hostname：
// - hostname 不是 localhost/127.0.0.1/0.0.0.0 → 边缘运行时（线上），只信 Access 注入的邮箱头，env 与请求头里的角色标记一律忽略。
// - 是 localhost 系列 → 本地 wrangler pages dev，按 X-Dev-Role > LOCAL_ROLE > 默认 admin 决定身份。
// 之所以不用 request.cf：wrangler pages dev 也会模拟该对象，无法据此区分。
// 生产域名永远不可能是 localhost，所以 hostname 作为信号最稳。
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export const resolveAdmin = (request: Request, env: Env): AdminIdentity | null => {
  const hostname = new URL(request.url).hostname;
  const isLocal = LOCAL_HOSTS.has(hostname);
  if (!isLocal) {
    const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim();
    return email ? { email } : null;
  }
  const headerRole = request.headers.get('X-Dev-Role')?.trim().toLowerCase();
  const envRole = env.LOCAL_ROLE?.trim().toLowerCase();
  const role = headerRole || envRole || 'admin';
  return role === 'visitor' ? null : { email: DEV_ADMIN_EMAIL };
};
