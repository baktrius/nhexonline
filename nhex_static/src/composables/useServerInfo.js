import { ref, computed } from "vue";
import conf from "@/conf.js";

const serverInfo = ref(null);
const loading = ref(true);
const error = ref(null);

async function fetchServerInfo() {
  try {
    serverInfo.value = await conf.getServerInfo();
  } catch (error) {
    error.value = error;
  } finally {
    loading.value = false;
  }
}

const boards = computed(() =>
  serverInfo.value?.res?.boards?.map((el) => ({
    title: el.name,
    value: el.id,
  })) ?? []
);

export function useServerInfo() {
  return {
    serverInfo,
    loading,
    error,
    boards,
    fetchServerInfo,
  };
}