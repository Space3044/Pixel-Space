import type { Env } from '../../types';
import { json } from '../../_shared/http';
import { resolveAdmin } from '../../_shared/auth';
import { withRequestLogging } from '../../_shared/logger';

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/me', async ({ request, env }) => {
  const admin = await resolveAdmin(request, env);
  if (!admin) return json({ error: 'unauthorized' }, 401);
  return json({ email: admin.email });
});
