import type { Env } from '../../types';
import { responseWithAdminImageUrl } from '../../_shared/admin-response';
import { withRequestLogging } from '../../_shared/logger';
import { handleCheckHashGet } from '../check-hash';

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/check-hash', async (context, logger) =>
  responseWithAdminImageUrl(await handleCheckHashGet(context, logger)),
);
