#!/usr/bin/env node

const express = require("express");
const http = require("http");
const websocket = require("ws");
const DbStorage = require("./src/DbStorage.js");
const config = require("./src/config.js");
const Tables = require("./src/tables.js");
const MainAgent = require("./src/mainAgent.js");
const url = require("url");
var cors = require('cors')

const app = express();
app.set("trust proxy", 1);

// initialize a simple http server
const server = http.createServer(app);
const port = 3001;

let serviceQuality = config.QUALITY_LEVELS_NUM;
const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || "http://localhost:3000";
const SERVE_STATIC = process.env.SERVE_STATIC || false;

let storage;
try {
  storage = new DbStorage("table_logs.jsonl");
} catch (err) {
  console.log("Error: unable to create storage.");
  console.log(err);
  process.exit(1);
}

const mainAgent = new MainAgent(MAIN_SERVER_URL);

function logUnhandledException(place, err) {
  storage.logEvent("unhandledException", {
    place: place,
    err: err,
  });
}

function performUnsafe(place, body) {
  return async (...args) => {
    try {
      await body(...args);
    } catch (error) {
      console.error("Error: unhandled exception in " + place, error);
      logUnhandledException(place, error);
    }
  };
}

process.on("SIGHUP", () => process.exit(128 + 1));
process.on("SIGINT", () => process.exit(128 + 2));
process.on("SIGTERM", () => process.exit(128 + 15));

const tablesList = new Tables(storage, serviceQuality, mainAgent);

let nextUserId = 0;

// initialize the WebSocket server instance
const wss = new websocket.Server({ server: server, clientsTracking: true });

process.on("exit", () => {
  storage.logEvent("serviceStop", null);
  storage.close();
  server.close();
  wss.close();
});

const monitors = new Set();
function addMonitor(ws) {
  monitors.add(ws);
  ws.on("close", () => monitors.delete(ws));
}

async function handleMessage(ws, data) {
  if (data.nick !== undefined) ws.userData.userName = data.nick;
  if (data.monitor === true) addMonitor(ws);
  if (data.subscribe !== undefined) tablesList.subscribe(ws);
  if (data.subscribeTable !== undefined)
    await tablesList.subscribeTable(ws, data.subscribeTable.id, data.subscribeTable.roleRequest);
  if (data.delays !== undefined)
    ws.userData.delays = ws.userData.delays.concat(data.delays);
  if (data.request !== undefined)
    ws.send(JSON.stringify({ request: data.request }));
}

function addWsTimeoutService(ws, pingInterval, allowedFailuresNum, onTimeout) {
  let timeoutService = 0;
  function resetTimeout() {
    clearInterval(timeoutService);
    let count = 0;
    timeoutService = setInterval(() => {
      if (count++ >= allowedFailuresNum) {
        onTimeout?.();
        ws.terminate();
      } else ws.ping();
    }, pingInterval);
  }
  resetTimeout();
  ws.on("message", resetTimeout);
  ws.on("pong", resetTimeout);
  ws.on("close", () => clearInterval(timeoutService));
}

function addWsLogger(ws, req) {
  ws.on(
    "close",
    performUnsafe("socket onClose handler", () => {
      storage.logEvent("connectionClose", {
        ip: req.socket.remoteAddress,
        port: req.socket.remotePort,
      });
    }),
  );
  ws.on(
    "error",
    performUnsafe("socket onError handler", () => {
      storage.logEvent("connectionError", {
        ip: req.socket.remoteAddress,
        port: req.socket.remotePort,
      });
    }),
  );
}

function getConnectionHandler(ws, params) {
  ws.onMessage = handleMessage;
  return performUnsafe("socket onMessage handler", (message) => {
    if (message == "{}") ws.send("{}");
    else {
      const data = JSON.parse(message);
      if (data) ws.onMessage(ws, data);
    }
  });
}

wss.on("connection", (ws, req) => {
  runStatsService();
  const params = url.parse(req.url, true).query;
  const handler = getConnectionHandler(ws, params);
  if (!handler) {
    ws.terminate();
    return;
  }
  ws.userData = {
    userId: nextUserId++,
    delays: [],
    sent: 0,
    sentBytes: 0,
    pinged: 0,
    received: 0,
    receivedBytes: 0,
    pongs: 0,
    active: true,
    cookie: req.headers.cookie,
  };
  ws.send(JSON.stringify({ account: false }));
  ws.on("message", handler);
  ws.on("error", () => ws.terminate());
  addWsLogger(ws, req);
  if (config.ENABLE_TIMEOUT) {
    addWsTimeoutService(
      ws,
      config.PING_TIMEOUT,
      3,
      performUnsafe(() => storage.logEvent("connectionTimeout", null)),
    );
  }
});

function setServiceQuality(newQuality) {
  if (newQuality < 0) storage.logEvent("requestedToLowQuality", null);
  newQuality = Math.min(config.QUALITY_LEVELS_NUM, Math.max(0, newQuality));
  if (newQuality != serviceQuality) {
    storage.logEvent("serviceQualityChange", newQuality);
    serviceQuality = newQuality;
    tablesList.setServiceQuality(newQuality);
  }
}

let increaseQualityCounter = 0;
let decreaseQualityCounter = 0;
function adjustServiceQuality(delayAvg) {
  if (config.ADJUST_SERVICE_QUALITY) {
    if (config.ADJUST_SERVICE_WS_CONNECTION_THRESHOLD >= wss.clients.size) {
      setServiceQuality(config.QUALITY_LEVELS_NUM);
    } else {
      if (delayAvg < config.INCREASE_QUALITY_THRESHOLD) {
        ++increaseQualityCounter;
      } else increaseQualityCounter = 0;
      if (delayAvg > config.DOUBLE_DECREASE_QUALITY_THRESHOLD) {
        decreaseQualityCounter += 2;
      }
      if (delayAvg > config.DECREASE_QUALITY_THRESHOLD) {
        ++decreaseQualityCounter;
      } else decreaseQualityCounter = 0;

      if (
        increaseQualityCounter >= config.ADJUST_SERVICE_INCREASE_INSENSITIVITY
      ) {
        increaseQualityCounter = 0;
        setServiceQuality(serviceQuality + 1);
      } else if (
        decreaseQualityCounter >= config.ADJUST_SERVICE_DECREASE_INSENSITIVITY
      ) {
        decreaseQualityCounter = 0;
        setServiceQuality(serviceQuality - 1);
      }
    }
  }
}

function logStat(stats) {
  const insertionRes = storage.logStat(stats);
  if (monitors.size > 0 && insertionRes) {
    try {
      const insertedStat = storage.getInsertedStat(insertionRes);
      if (insertedStat === undefined) throw new Error("db returned empty row.");
      const statsString = JSON.stringify({ stats: [insertedStat] });
      monitors.forEach((ws) => ws.send(statsString));
    } catch (err) {
      console.log("err: unable to read inserted stats");
      console.log(err);
    }
  }
}

let statsService = null;
function runStatsService() {
  if (config.STATS_SERVICE_INTERVAL > 0 && statsService === null) {
    statsService = setInterval(function () {
      try {
        const clients = wss.clients;

        let handledRequests = 0;
        let delaysSum = 0;
        let delayMax = 0;
        let delayMin = Number.MAX_SAFE_INTEGER;
        let sent = 0;
        let sentBytes = 0;
        let received = 0;
        let receivedBytes = 0;
        let pinged = 0;
        let pongs = 0;
        clients.forEach((ws) => {
          handledRequests += ws.userData.delays.length;
          delaysSum += ws.userData.delays.reduce((acc, el) => acc + el, 0);
          delayMax = Math.max(delayMax, ...ws.userData.delays);
          delayMin = Math.min(delayMin, ...ws.userData.delays);
          sent += ws.userData.sent;
          sentBytes += ws.userData.sentBytes;
          received += ws.userData.received;
          receivedBytes += ws.userData.receivedBytes;
          pinged += ws.userData.pinged;
          pongs += ws.userData.pongs;
        });
        const delayAvg = handledRequests > 0 ? delaysSum / handledRequests : 0;
        delayMin = handledRequests > 0 ? delayMin : 0;
        const memoryUsage = process.memoryUsage();

        clients.forEach((ws) => {
          ws.userData.delays = [];
          ws.userData.sent = 0;
          ws.userData.sentBytes = 0;
          ws.userData.received = 0;
          ws.userData.receivedBytes = 0;
          ws.userData.pinged = 0;
          ws.userData.pongs = 0;
        });

        if (wss.clients.size == 0) {
          clearInterval(statsService);
          statsService = null;
        }

        adjustServiceQuality(delayAvg);
        logStat({
          activeWsConnections: wss.clients.size,
          tableSubscriptions: tablesList.getSubscriptionsNum(),
          activePlayers: tablesList.getActivePlayersNum(),
          handledRequests: handledRequests,
          avgDelay: delayAvg,
          minDelay: delayMin,
          maxDelay: delayMax,
          sentMes: sent,
          sentBytes: sentBytes,
          receivedMes: received,
          receivedBytes: receivedBytes,
          pings: pinged,
          pongs: pongs,
          serviceQuality: serviceQuality,
          memory_rss: memoryUsage.rss,
          memory_heapTotal: memoryUsage.heapTotal,
          memory_heapUsed: memoryUsage.heapUsed,
          memory_external: memoryUsage.external,
        });
      } catch (error) {
        logUnhandledException("stats gathering service", error);
      }
    }, config.STATS_SERVICE_INTERVAL);
  }
}

app.use(cors())
app.use(express.urlencoded({ extended: true }));
app.post("/tables/", async (req, res) => {
  const board = req.body?.board;
  const tableId = await tablesList.createTable(board);
  res.send({ tableId });
});
if (SERVE_STATIC) {
  app.use(express.static(SERVE_STATIC));
}

// start our server
server.listen(process.env.PORT || port, () => {
  storage.logEvent("serverStart", { port: server.address().port });
  console.log(`Running on: http://localhost:${port}`);
});
