import { createRouter, createWebHistory } from 'vue-router';

import { isAdmin, refreshAdmin } from '@/shared/auth/useAdmin';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/features/home/HomeView.vue'),
      meta: {
        title: '首页',
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: {
        title: '接入',
      },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/features/upload/UploadView.vue'),
      meta: {
        title: '上传',
        requiresAdmin: true,
      },
    },
    {
      path: '/images',
      name: 'gallery',
      component: () => import('@/features/images/GalleryView.vue'),
      meta: {
        title: '探索',
      },
    },
    {
      path: '/p/:key',
      name: 'public-image',
      component: () => import('@/features/images/PublicImageView.vue'),
      props: true,
      meta: {
        title: '公开图片',
      },
    },
    {
      path: '/random',
      name: 'random',
      component: () => import('@/features/random/RandomView.vue'),
      meta: {
        title: '随机',
      },
    },
    {
      path: '/hive',
      name: 'hive',
      component: () => import('@/features/hive/HiveView.vue'),
      meta: {
        title: '足迹',
      },
    },
  ],
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true;
  if (!isAdmin.value) await refreshAdmin();
  if (isAdmin.value) return true;
  return { name: 'login', query: { redirect: to.fullPath } };
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Pixel Space')} · Pixel Space`;
});

export default router;
