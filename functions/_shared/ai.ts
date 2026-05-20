import type { Env } from '../types';

export interface AiSettings {
  proxy_url: string;
  model: string;
}

export interface AiPreviewResult {
  title: string;
  caption: string;
  tags: string[];
  search_content: string;
}

interface AnalyzeImageInput {
  env: Env;
  image: File;
}

const SETTINGS_SQL = 'SELECT proxy_url, model FROM ai_settings WHERE id = 1';

const AI_SYSTEM_PROMPT = `# 图片结构化分析专家

你是一个图片分析专家。你的任务是分析用户提供的图片，严格按照指定的 JSON Schema 输出结构化结果，不要添加任何额外解释、注释或前缀。

## 必须覆盖的分析维度（内部完成，不输出）

在生成最终 JSON 之前，你必须在内部完成以下 6 个维度的分析：

1. **主体识别**：图片中最核心的视觉对象是什么（物、人、场景）？
2. **场景与环境**：背景、空间逻辑、前景 / 中景 / 背景关系。
3. **视觉风格与颜色**：整体色调、饱和度、冷暖、光影、构图和情绪氛围。
4. **标题与描述构思**：从画面可见信息里提炼一个有画面感的摄影作品标题，并写出自然、具体、不空泛的描述。
5. **可检索特征**：适合作为标签和搜索词的关键词，覆盖主体、场景、色彩、风格、情绪、构图、材质等。
6. **搜索用词**：将上述特征转化为空格分隔的关键词集合，包含必要同义词、上位词和相关风格词。

## 输出 Schema（严格遵守）

\`\`\`json
{
  "title": "string",
  "caption": "string",
  "tags": ["string"],
  "search_content": "string"
}
\`\`\`

## 字段要求

- **title**：4 到 10 个中文，像摄影作品标题，要有画面感和审美感。优先使用“主体 + 氛围 / 光影 / 色彩 / 场景”的组合，例如“雾色山脊”“窗边暖光”。避免“图片”“照片”“一只猫”这类直白标题。禁止使用文件名、URL、地点名、人名或品牌，除非画面中明确可见。
- **caption**：1 到 2 句，约 35 到 90 个中文。描述主体、环境、构图、光线、色彩和情绪，可以有轻微审美表达，但必须来自画面可见信息，不编造具体地点、人物身份、事件或未显示细节。
- **tags**：6 到 10 个中文短标签，覆盖主体、场景、色彩、风格、情绪、构图 / 材质等维度。标签要具体、可搜索、少重复，避免只写“好看”“照片”“图片”这类泛词。示例：["蓝天", "山脉", "风景摄影", "冷色调", "宁静", "远景构图"]。
- **search_content**：用于搜索引擎的关键词合集，空格分隔，不要写成句子。包含标题核心词、主体词、同义词（如“女孩”→“少女”）、上位词（如“橘猫”→“猫 动物 宠物”）、场景词、色彩词、风格词、情绪词和构图词。关键词去重，不要使用逗号、句号或换行。

## 输出要求（绝对禁止违反）

1. **只输出一个合法的 JSON 对象**，不要包含 markdown 代码块标记（如 \`\`\`json 或 \`\`\`），不要输出任何其他文字。
2. 不要输出“好的”、“以下是分析结果”等前缀或后缀。
3. 不要输出分析过程、不要解释你的选择。
4. 确保字符串中的双引号、换行符正确转义。
5. 如果图片中没有清晰的主体，仍需尽力提取风格和氛围信息。

## 工作流程

- 用户附上图片后，你在内部完成 6 个维度的分析（不输出）。
- 直接输出符合上述 Schema 的 JSON 对象。
- 结束。

## 常见错误（避免）

- ❌ 输出 JSON 前加任何说明文字。
- ❌ 使用 markdown 代码块包裹 JSON。
- ❌ title 太直白、超过 10 字或使用文件名。
- ❌ caption 只有几个词，或包含编造的细节。
- ❌ tags 数量少于 6 或多于 10，或不覆盖要求维度。
- ❌ search_content 写成完整句子、包含标点、重复堆词。`;

const AI_USER_PROMPT = '请分析这张图片，直接输出符合上述 Schema 的 JSON 对象。';

export const getAiSettings = async (env: Pick<Env, 'DB'>): Promise<AiSettings> => {
  const row = await env.DB.prepare(SETTINGS_SQL).first<AiSettings>();
  return {
    proxy_url: row?.proxy_url?.trim() ?? '',
    model: row?.model?.trim() ?? '',
  };
};

export const hasUsableAiSettings = (settings: AiSettings, proxyKey: string | undefined): boolean =>
  Boolean(settings.proxy_url && settings.model && proxyKey?.trim());

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
};

const contentToJsonText = (content: unknown): string => {
  if (typeof content !== 'string') throw new Error('ai_response_missing_content');
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
};

const stringValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeTags = (value: unknown): string[] => {
  const tags = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : typeof value === 'string'
      ? value
          .split(/[,，\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return [...new Set(tags)];
};

const normalizeAiResult = (value: unknown): AiPreviewResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ai_response_invalid_json');
  }

  const data = value as Record<string, unknown>;
  const title = stringValue(data.title);
  const caption = stringValue(data.caption);
  const tags = normalizeTags(data.tags);
  const searchContent =
    stringValue(data.search_content) || [title, caption, ...tags].filter(Boolean).join(' ');

  return {
    title,
    caption,
    tags,
    search_content: searchContent,
  };
};

const parseAiContent = (content: unknown): AiPreviewResult => {
  const jsonText = contentToJsonText(content);
  return normalizeAiResult(JSON.parse(jsonText) as unknown);
};

export const analyzeImageWithAi = async ({ env, image }: AnalyzeImageInput): Promise<AiPreviewResult> => {
  const settings = await getAiSettings(env);
  if (!hasUsableAiSettings(settings, env.PROXY_KEY)) {
    throw new Error('missing_ai_settings');
  }

  const dataUrl = `data:${image.type};base64,${arrayBufferToBase64(await image.arrayBuffer())}`;
  const response = await fetch(settings.proxy_url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PROXY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: 'system',
          content: AI_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: AI_USER_PROMPT,
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `ai_proxy_http_${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  return parseAiContent(data.choices?.[0]?.message?.content);
};
