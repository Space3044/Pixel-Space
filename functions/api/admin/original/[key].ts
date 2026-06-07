import type { Env } from '../../../types';
import { withRequestLogging } from '../../../_shared/logger';
import { handleOriginalGet } from '../../original/[key]';

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/original/:key', handleOriginalGet);
