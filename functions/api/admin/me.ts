import type { Env } from '../../types';
import { json } from '../../_shared/http';
import { resolveAdmin } from '../../_shared/auth';

// 返回当前请求者的管理员身份信息。
// 200 + { email } 表示是管理员，401 表示访客。
// 前端用这个接口刷管理员状态，决定路由守卫和 UI 条件渲染。
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = resolveAdmin(request, env);
  if (!admin) return json({ error: 'unauthorized' }, 401);
  return json({ email: admin.email });
};
