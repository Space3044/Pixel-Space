import type { Env } from '../types';
import { json, serverError } from '../_shared/http';
import { LIST_FOLDERS_SQL, type FolderRecord } from '../_shared/folders';

// 公开的文件夹列表：访客和管理员都能拿到，用于探索页按目录筛选。
// 文件夹名作为对外可见的归类元数据；如未来要藏归类信息，再给 folders 加 is_public 列。
// 写操作（新建/重命名/删除）仍走 /api/admin/folders/* 系列接口。
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const result = await env.DB.prepare(LIST_FOLDERS_SQL).all<FolderRecord>();
    return json({ folders: result.results ?? [] });
  } catch (error) {
    console.error('GET /api/folders failed', error);
    return serverError('folders_list_failed');
  }
};
