<template>
  <div style="width: 800px; height: 600px">
    <TableClient :tableId="tableId" :serverInfo="serverInfo" :roleRequest="{ role: 'player' }" :conf="conf" />
  </div>
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
