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
    let message = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data.error === 'string') message = data.error;
    } catch {
      const text = await response.text().catch(() => '');
      if (text) message = text;
    }
    throw new Error(`AI 分析失败：${message}`);
  }

  return (await response.json()) as AiPreviewResult;
}
