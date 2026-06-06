import type { Env } from '../../types';
import { responseWithAdminImageUrl } from '../../_shared/admin-response';
import { onRequestPost as uploadPost } from '../upload';

export const onRequestPost: PagesFunction<Env> = async (context) =>
  responseWithAdminImageUrl(await uploadPost(context));
