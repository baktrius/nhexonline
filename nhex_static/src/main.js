import { createApp } from 'vue'
import './style.css'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

import App from './App.vue'

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark'
  }
})

createApp(App).use(vuetify).mount('#app')

if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
}
