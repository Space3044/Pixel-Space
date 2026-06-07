import type { Env } from '../../types';
import { responseWithAdminImageUrl } from '../../_shared/admin-response';
import { withRequestLogging } from '../../_shared/logger';
import { handleUploadPost } from '../upload';

export const onRequestPost: PagesFunction<Env> = withRequestLogging('/api/admin/upload', async (context, logger) =>
  responseWithAdminImageUrl(await handleUploadPost(context, logger)),
);
