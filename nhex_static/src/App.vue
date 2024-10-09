<template>
  <v-progress-circular color="primary" indeterminate v-if="loading && showLoader"></v-progress-circular>
  <RouterView v-if="!loading" />
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useServerInfo } from "./composables/useServerInfo";

const { loading, error, fetchServerInfo } = useServerInfo();
const showLoader = ref(false);

onMounted(() => {
  setTimeout(() => {
    showLoader.value = true;
  }, 200);
});

fetchServerInfo();
</script>
