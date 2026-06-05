import type { Env } from '../../types';
import { json } from '../../_shared/http';
import { resolveAdmin } from '../../_shared/auth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = resolveAdmin(request, env);
  if (!admin) return json({ error: 'unauthorized' }, 401);
  return json({ email: admin.email });
};
