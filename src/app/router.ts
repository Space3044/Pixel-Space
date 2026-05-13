import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/images',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: {
        title: '登录',
      },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/features/upload/UploadView.vue'),
      meta: {
        title: '上传',
      },
    },
    {
      path: '/images',
      name: 'gallery',
      component: () => import('@/features/images/GalleryView.vue'),
      meta: {
        title: '图库',
      },
    },
    {
      path: '/images/:key',
      name: 'image-detail',
      component: () => import('@/features/images/ImageDetailView.vue'),
      props: true,
      meta: {
        title: '图片详情',
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
  ],
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '图库')} · 幽浮图床`;
});

export default router;
