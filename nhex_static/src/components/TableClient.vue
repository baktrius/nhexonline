<script setup>
import mount, { ReconnectingWS } from "nhex-table-client";
import { onMounted, onUnmounted, useTemplateRef } from "vue";

const { tableId, roleRequest, serverInfo, conf } = defineProps({
  tableId: String,
  roleRequest: Object,
  serverInfo: Object,
  conf: Object,
});

const clientRoot = useTemplateRef("wrapper");

let gameInstance = null;

onMounted(() => {
  gameInstance = mount(
    clientRoot.value,
    tableId,
    conf,
    roleRequest,
    (conf) => new ReconnectingWS(`${serverInfo.tss_ws_url}/ws2/`, conf),
    serverInfo,
  );
});

onUnmounted(() => {
  gameInstance?.destroy?.();
});
</script>
<template>
  <div ref="wrapper"></div>
</template>
