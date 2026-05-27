export interface TelegramArchiveResult {
  file_id: string;
  message_id: number;
  chat_id: string;
}

interface TelegramSendDocumentResponse {
  ok: boolean;
  description?: string;
  result?: {
    message_id?: number;
    chat?: {
      id?: number | string;
    };
    document?: {
      file_id?: string;
    };
  };
}

interface TelegramGetFileResponse {
  ok: boolean;
  description?: string;
  result?: {
    file_path?: string;
  };
}

const API_BASE = 'https://api.telegram.org';

async function readTelegramJson<T>(response: Response, failureCode: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${failureCode}: invalid_json`);
  }
}

function sanitizeTelegramError(description: unknown, token: string): string {
  const message = typeof description === 'string' && description.trim() ? description.trim() : 'request_failed';
  return message.replaceAll(token, '[redacted]').slice(0, 300);
}

function assertTelegramConfig(token: string, chatId?: string): void {
  if (!token || !chatId) {
    throw new Error('telegram_archive_failed: missing_config');
  }
}

export async function archiveOriginalToTelegram(input: {
  token: string;
  chatId: string;
  file: File;
  key: string;
}): Promise<TelegramArchiveResult> {
  assertTelegramConfig(input.token, input.chatId);

  const formData = new FormData();
  formData.set('chat_id', input.chatId);
  formData.set('caption', `imgbed:${input.key}`);
  formData.set('document', input.file);

  const response = await fetch(`${API_BASE}/bot${input.token}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
  const data = await readTelegramJson<TelegramSendDocumentResponse>(response, 'telegram_archive_failed');

  if (!response.ok || !data.ok) {
    throw new Error(`telegram_archive_failed: ${sanitizeTelegramError(data.description, input.token)}`);
  }

  const fileId = data.result?.document?.file_id;
  const messageId = data.result?.message_id;
  const chatId = data.result?.chat?.id;
  if (!fileId || typeof messageId !== 'number' || chatId === undefined || chatId === null) {
    throw new Error('telegram_archive_failed: invalid_response');
  }

  return {
    file_id: fileId,
    message_id: messageId,
    chat_id: String(chatId),
  };
}

export async function getTelegramFileUrl(token: string, fileId: string): Promise<string> {
  if (!token || !fileId) {
    throw new Error('telegram_file_failed: missing_config');
  }

  const response = await fetch(`${API_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const data = await readTelegramJson<TelegramGetFileResponse>(response, 'telegram_file_failed');

  if (!response.ok || !data.ok) {
    throw new Error(`telegram_file_failed: ${sanitizeTelegramError(data.description, token)}`);
  }

  const filePath = data.result?.file_path;
  if (!filePath) {
    throw new Error('telegram_file_failed: invalid_response');
  }

  return `${API_BASE}/file/bot${token}/${filePath.replace(/^\/+/, '')}`;
}

export async function deleteTelegramMessage(input: {
  token: string;
  chatId: string;
  messageId: number;
}): Promise<void> {
  if (!input.token || !input.chatId || !input.messageId) {
    throw new Error('telegram_delete_failed: missing_config');
  }

  const formData = new FormData();
  formData.set('chat_id', input.chatId);
  formData.set('message_id', String(input.messageId));

  const response = await fetch(`${API_BASE}/bot${input.token}/deleteMessage`, {
    method: 'POST',
    body: formData,
  });
  const data = await readTelegramJson<{ ok?: boolean; description?: string }>(response, 'telegram_delete_failed');

  if (!response.ok || !data.ok) {
    throw new Error(`telegram_delete_failed: ${sanitizeTelegramError(data.description, input.token)}`);
  }
}
