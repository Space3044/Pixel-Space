import type { Env } from '../../types';
import { resolveAdmin } from '../../_shared/auth';
import { unauthorized } from '../../_shared/http';
import { handleListImages } from '../../_shared/list-images';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!(await resolveAdmin(request, env))) return unauthorized();
  return handleListImages(env, request, { admin: true, logPath: '/api/admin/list' });
};
