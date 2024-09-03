<script setup>
import { ref, computed, watch } from "vue";

const serverInfo = ref(null);

async function getServerInfo() {
  serverInfo.value = await (await fetch(`${location.protocol}//${location.host}/serverInfo`)).json();
}

const boards = computed(
  () =>
    serverInfo.value?.res?.boards?.map((el) => ({
      title: el.name,
      value: el.id,
    })) ?? [],
);
const selectedBoard = ref(null);

getServerInfo().then(() => {
  selectedBoard.value = boards.value[0].value;
});

function getIdFromHash() {
  const val = window.location.hash?.slice?.(1);
  return val || null;
}

const gameId = ref(getIdFromHash());
const generatingId = ref(false);

async function getNewGameId() {
  return (
    await (
      await fetch(`${serverInfo.value.tss_url}/tables/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          board: selectedBoard.value,
        }),
      })
    ).json()
  ).tableId;
}

async function createGame() {
  generatingId.value = true;
  gameId.value = await getNewGameId();
  generatingId.value = false;
}

const copyInfo = ref(false);
const copyInfoText = ref("");

async function copyURL() {
  try {
    await navigator.clipboard.writeText(gameUrl.value);
  } catch (err) {
    copyInfoText.value = "Failed to copy!";
    copyInfo.value = true;
  }
  copyInfoText.value = "Copied!";
  copyInfo.value = true;
}

function play() {
  window.location = `${location.protocol}//${location.host}/play.html#${gameId.value}`;
}

const gameUrl = computed(() => {
  return `${location.protocol}//${location.host}/#${gameId.value}`;
});

// Update URL when gameId changes
watch(gameId, (newGameId) => {
  if (newGameId) window.location.hash = newGameId;
  else window.location.hash = "";
});

// Update gameId when URL changes
window.addEventListener("hashchange", () => {
  gameId.value = getIdFromHash();
});
</script>

<template>
  <h1 @click="gameId = null" class="mb-4">Nhex static</h1>
  <div v-if="!serverInfo">
    <v-progress-circular color="primary" indeterminate></v-progress-circular>
  </div>
  <div v-else-if="!gameId">
    <v-select label="Board" :items="boards" v-model="selectedBoard"></v-select>
    <v-btn block @click="createGame" :disabled="generatingId">
      <span v-if="generatingId">Loading...</span>
      <span v-else>Create new game</span>
    </v-btn>
  </div>
  <div v-else>
    <v-text-field label="Game URL" readonly :model-value="gameUrl"></v-text-field>
    <v-btn block class="mb-2" @click="copyURL">Copy URL</v-btn>
    <v-snackbar v-model="copyInfo" timeout="2000">
      {{ copyInfoText }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="copyInfo = false"> Close </v-btn>
      </template>
    </v-snackbar>
    <v-btn block @click="play">Play</v-btn>
  </div>
</template>

<style scoped>
h1 {
  font-size: 3.2em;
  line-height: 1.1;
  cursor: pointer;
}
</style>
