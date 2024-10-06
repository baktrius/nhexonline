<template>
  <v-text-field label="Game URL" readonly :model-value="tableUrl"></v-text-field>
  <v-btn block class="mb-2" @click="copyURL">Copy URL</v-btn>
  <v-snackbar v-model="copyInfo" timeout="2000">
    {{ copyInfoText }}
    <template v-slot:actions>
      <v-btn color="white" variant="text" @click="copyInfo = false"> Close </v-btn>
    </template>
  </v-snackbar>
  <RouterLink :to="{ name: 'PlayTable', params: { tableId } }" class="btn">
    <v-btn block class="mb-2">Join</v-btn>
  </RouterLink>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const { tableId } = defineProps({
  tableId: String,
});

const router = useRouter();
const copyInfo = ref(false);
const copyInfoText = ref("");

const tableUrl = computed(
  () => window.location.origin + router.resolve({ name: "JoinTable", params: { tableId } }).href,
);

async function copyURL() {
  try {
    await navigator.clipboard.writeText(tableUrl.value);
    copyInfoText.value = "Copied!";
  } catch (err) {
    console.error(err);
    copyInfoText.value = "Failed to copy! Try doing it manually.";
  }
  copyInfo.value = true;
}
</script>
<style scoped>
.btn {
  text-decoration: none;
  color: inherit;
}
</style>
