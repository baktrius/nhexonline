<template>
  <RouterLink to="/" style="text-decoration: none">
    <h1 class="mb-4">Nhex static</h1>
  </RouterLink>
  <div v-if="loading">
    <v-progress-circular color="primary" indeterminate></v-progress-circular>
  </div>
  <RouterView v-else />
</template>

<script setup>
import { RouterLink } from "vue-router";
import { useServerInfo } from "./composables/useServerInfo";

const { loading, error, fetchServerInfo } = useServerInfo();

fetchServerInfo();
</script>

<style scoped>
h1 {
  font-size: 3.2em;
  line-height: 1.1;
  cursor: pointer;
  color: white;
}
</style>
