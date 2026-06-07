import type { Env } from '../../../types';
import { withRequestLogging } from '../../../_shared/logger';
import { handleOriginalGet } from '../../../_shared/original';

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/original/:key', handleOriginalGet);
