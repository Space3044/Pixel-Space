import type { Env } from '../types';
import { handleListImages } from '../_shared/list-images';
import { withRequestLogging } from '../_shared/logger';

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/list', async ({ env, request }, logger) =>
  handleListImages(env, request, { admin: false, logPath: '/api/list', logger }),
);
