import type { Env } from '../../../types';
import { withRequestLogging } from '../../../_shared/logger';
import { handleAiPreviewPost } from '../../ai/preview';

export const onRequestPost: PagesFunction<Env> = withRequestLogging('/api/admin/ai/preview', handleAiPreviewPost);
