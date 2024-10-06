<template>
  <v-select label="Board" :items="boards" v-model="selectedBoard"></v-select>
  <v-btn block @click="createGame" :disabled="generatingId">
    <span v-if="generatingId">Loading...</span>
    <span v-else>Create new game</span>
  </v-btn>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useServerInfo } from "../composables/useServerInfo";

const generatingId = ref(false);
const router = useRouter();
const { serverInfo, boards } = useServerInfo();
const selectedBoard = ref(boards.value[0].value);

async function getNewTable() {
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
  router.push({ name: "JoinTable", params: { tableId: await getNewTable() } });
  generatingId.value = false;
}
</script>
