import { createApp } from 'vue'
import './style.css'

import { createRouter, createWebHashHistory } from 'vue-router'

import HomeView from './views/HomeView.vue'
import JoinTableView from './views/JoinTableView.vue'
import PlayTableView from './views/PlayTableView.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

import App from './App.vue'

const routes = [
  { path: '/', component: HomeView },
  { path: '/tables/:tableId', component: JoinTableView, name: 'JoinTable', props: true },
  { path: '/tables/:tableId/play', component: PlayTableView, name: 'PlayTable', props: true },
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
