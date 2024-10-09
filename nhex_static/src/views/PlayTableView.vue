<template>
  <TableClient
    :tableId="tableId"
    :serverInfo="serverInfo"
    :roleRequest="{ role: 'player' }"
    :conf="conf"
    style="flex-grow: 1; width: 100%; height: 0"
  />
</template>
<script setup>
import TableClient from "@/components/TableClient.vue";
import { useServerInfo } from "@/composables/useServerInfo";
import conf from "@/conf";

const { tableId } = defineProps({
  tableId: String,
});

const { serverInfo } = useServerInfo();
</script>
