// 全局单例：保存当前管理员身份状态、本地角色偏好，以及一个为所有 fetch 自动注入 X-Dev-Role 的薄包装。
// 仅 import.meta.env.DEV 时角色切换 UI 才会暴露给用户。

import { computed, readonly, ref } from 'vue';

export type DevRole = 'admin' | 'visitor';

interface AdminMe {
  email: string;
}

const STORAGE_KEY = 'imgbed:dev-role';
const DEV_HEADER = 'X-Dev-Role';
const ME_ENDPOINT = '/api/admin/me';

const readStoredRole = (): DevRole | null => {
  if (typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'admin' || value === 'visitor' ? value : null;
};

// dev 模式默认 admin；prod 模式 devRole 永远 null，对 fetch 注入无影响。
const initialRole: DevRole | null = import.meta.env.DEV ? readStoredRole() ?? 'admin' : null;

const devRole = ref<DevRole | null>(initialRole);
const adminEmail = ref<string | null>(null);
const adminLoading = ref(false);
const adminChecked = ref(false);

export const isAdmin = computed(() => adminEmail.value !== null);
export const isDev = import.meta.env.DEV;

export { devRole };

const installFetchInterceptor = () => {
  if (typeof window === 'undefined') return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (!import.meta.env.DEV || devRole.value === null) {
      return originalFetch(input, init);
    }
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : '';
    // 只对本站 /api/* 注入；外部地址（地图瓦片、Telegram 等）一律不动。
    if (!url.startsWith('/api/') && !url.includes(`${window.location.origin}/api/`)) {
      return originalFetch(input, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(DEV_HEADER, devRole.value);
    if (input instanceof Request) {
      return originalFetch(new Request(input, { headers }));
    }
    return originalFetch(input, { ...(init ?? {}), headers });
  };
};

installFetchInterceptor();

export const refreshAdmin = async (): Promise<void> => {
  adminLoading.value = true;
  try {
    const response = await fetch(ME_ENDPOINT);
    if (!response.ok) {
      adminEmail.value = null;
      return;
    }
    const data = (await response.json()) as AdminMe;
    adminEmail.value = data.email;
  } catch {
    adminEmail.value = null;
  } finally {
    adminLoading.value = false;
    adminChecked.value = true;
  }
};

export const setDevRole = (next: DevRole): void => {
  if (!import.meta.env.DEV) return;
  devRole.value = next;
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
  void refreshAdmin();
};

export const useAdmin = () => ({
  isAdmin,
  adminEmail: readonly(adminEmail),
  adminLoading: readonly(adminLoading),
  adminChecked: readonly(adminChecked),
  devRole: readonly(devRole),
  isDev: import.meta.env.DEV,
  refreshAdmin,
  setDevRole,
});
