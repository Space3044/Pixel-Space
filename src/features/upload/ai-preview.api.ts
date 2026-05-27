import { readHttpError } from '@/shared/api/http';

export interface AiPreviewResult {
  title: string;
  caption: string;
  tags: string[];
  search_content: string;
  dominant_color: string;
  palette: string[];
  composition: string;
}

export async function previewAiAnnotation(image: File): Promise<AiPreviewResult> {
  const formData = new FormData();
  formData.append('image', image, image.name);

  const response = await fetch('/api/ai/preview', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`AI 分析失败：${await readHttpError(response)}`);
  }

  return (await response.json()) as AiPreviewResult;
}
