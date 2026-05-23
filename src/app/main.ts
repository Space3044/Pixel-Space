import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { refreshAdmin } from '@/shared/auth/useAdmin';
import '../styles/main.css';

void refreshAdmin();

createApp(App).use(router).mount('#app');
