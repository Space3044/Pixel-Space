const jsonErrorMessage = (text: string): string | null => {
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const data = value as Record<string, unknown>;
    for (const key of ['error', 'message']) {
      const message = data[key];
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  } catch {
    return null;
  }

  return null;
};

export const readHttpError = async (response: Response): Promise<string> => {
  const text = (await response.text()).trim();
  if (!text) return `HTTP ${response.status}`;
  return jsonErrorMessage(text) ?? text;
};

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} failed: ${await readHttpError(response)}`);
  }

  return (await response.json()) as T;
}
