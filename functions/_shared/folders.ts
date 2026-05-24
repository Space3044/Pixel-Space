// 文件库（分类文件夹）共享工具。
// 文件夹层级与图片归属解耦：图片只引用一个 folder_id，文件夹自带 parent_id 形成树。
// 该模块仅服务管理员，调用方在 endpoint 内 requireAdmin 闸门。

export interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface FolderRecord extends FolderRow {
  image_count: number;
  child_count: number;
}

// SQL：拉所有文件夹并左联图片表统计直接子图片数 + 直接子目录数。
// 不递归汇总：每个文件夹只看自己一层，UI 显示的「文件夹大小」由调用方自行决定要不要展开。
export const LIST_FOLDERS_SQL = `
SELECT
  f.id,
  f.parent_id,
  f.name,
  f.created_at,
  f.updated_at,
  COALESCE(image_counts.image_count, 0) AS image_count,
  COALESCE(child_counts.child_count, 0) AS child_count
FROM folders f
LEFT JOIN (
  SELECT folder_id, COUNT(*) AS image_count
  FROM images
  WHERE folder_id IS NOT NULL
  GROUP BY folder_id
) image_counts ON image_counts.folder_id = f.id
LEFT JOIN (
  SELECT parent_id, COUNT(*) AS child_count
  FROM folders
  WHERE parent_id IS NOT NULL
  GROUP BY parent_id
) child_counts ON child_counts.parent_id = f.id
ORDER BY f.parent_id, f.name COLLATE NOCASE
`;

// 名字规则：长度 1..64，禁用控制字符与 /\ 让前端路径展示不至于歧义。
const NAME_MIN = 1;
const NAME_MAX = 64;
const NAME_FORBIDDEN = /[\\/\x00-\x1f]/;

export const sanitizeFolderName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) return null;
  if (NAME_FORBIDDEN.test(trimmed)) return null;
  return trimmed;
};

// parent_id 输入可能是 null/undefined/空字符串/字符串，前两者统一为 null（表示「在根下」）。
export const normalizeParentId = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

// 给一个文件夹 id，返回它的全部后代 id（含自身）。用于校验「不能把目录移到自己子树里」。
export async function collectDescendantIds(db: D1Database, rootId: string): Promise<Set<string>> {
  const visited = new Set<string>([rootId]);
  let frontier: string[] = [rootId];
  while (frontier.length > 0) {
    const placeholders = frontier.map(() => '?').join(',');
    const result = await db
      .prepare(`SELECT id FROM folders WHERE parent_id IN (${placeholders})`)
      .bind(...frontier)
      .all<{ id: string }>();
    const next: string[] = [];
    for (const row of result.results ?? []) {
      if (!visited.has(row.id)) {
        visited.add(row.id);
        next.push(row.id);
      }
    }
    frontier = next;
  }
  return visited;
}
