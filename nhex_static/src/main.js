import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'

import './style.css'

import HomeView from './views/HomeView.vue'
import JoinTableView from './views/JoinTableView.vue'
import DefaultLayout from './layouts/DefaultLayout.vue'
import PlayLayout from './layouts/PlayLayout.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

import App from './App.vue'

const routes = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', component: HomeView },
      { path: 'tables/:tableId', component: JoinTableView, name: 'JoinTable', props: true },
    ],
  },
  {
    path: '/tables/:tableId/play',
    component: PlayLayout,
    children: [
      { path: '', component: () => import('./views/PlayTableView.vue'), name: 'PlayTable', props: true },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark'
  }
})

createApp(App)
  .use(router)
  .use(vuetify)
  .mount('#app')
