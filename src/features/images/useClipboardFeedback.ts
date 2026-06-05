import { ref } from 'vue';

interface ClipboardFeedbackOptions {
  resetMs?: number;
  writeText?: (value: string) => Promise<void>;
}

const defaultWriteText = async (value: string): Promise<void> => {
  await navigator.clipboard.writeText(value);
};

export const useClipboardFeedback = (options: ClipboardFeedbackOptions = {}) => {
  const copied = ref(false);
  const copiedText = ref('');
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  const resetMs = options.resetMs ?? 1400;
  const writeText = options.writeText ?? defaultWriteText;

  const clearCopyTimer = () => {
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = null;
    copied.value = false;
    copiedText.value = '';
  };

  const copyValue = async (value: string, label = '链接') => {
    try {
      await writeText(value);
    } catch {
      return;
    }
    copiedText.value = label;
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
      copiedText.value = '';
      copyTimer = null;
    }, resetMs);
  };

  return {
    copied,
    copiedText,
    copyValue,
    clearCopyTimer,
  };
};
