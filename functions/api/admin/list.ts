import type { Env } from '../../types';
import { resolveAdmin } from '../../_shared/auth';
import { unauthorized } from '../../_shared/http';
import { handleListImages } from '../../_shared/list-images';
import { withRequestLogging } from '../../_shared/logger';

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/list', async ({ env, request }, logger) => {
  if (!(await resolveAdmin(request, env))) return unauthorized();
  return handleListImages(env, request, { admin: true, logPath: '/api/admin/list', logger });
});
