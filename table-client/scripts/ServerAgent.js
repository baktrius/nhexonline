import deepmerge from "./deepmerge.js";
const CONNECTION_CHECK_DELAY = 3000;

export default class ServerAgent {
  constructor(ws, onReqInit, onReqEnd) {
    this.ws = ws;
    this.onReqInit = onReqInit;
    this.onReqEnd = onReqEnd;
    this.requestActive = false;
    this.requestCallback = null;
    this.startedRequestId = 0;
    this.completedRequestId = 0;
    this.requestStart = [];
    this.lastRequestDuration = 0;
    this.connectionCheckService = false;
    this.objToSend = {};
    this.sendService = null;
  }
  connectionCheckAction() {
    this.request();
  }
  stopConnectionCheckService() {
    if (this.connectionCheckService) {
      clearTimeout(this.connectionCheckService);
      this.connectionCheckService = false;
    }
  }
  startConnectionCheckService() {
    this.stopConnectionCheckService();
    this.connectionCheckService = setTimeout(
      this.connectionCheckAction.bind(this),
      CONNECTION_CHECK_DELAY,
    );
  }
  finalizeSend() {
    clearTimeout(this.sendService);
    this.sendService = null;
    if (this.objToSend.request) this.objToSend.request = this.startRequest();
    this.ws.send(JSON.stringify(this.objToSend));
    this.objToSend = {};
  }
  lazySendMes(data) {
    this.objToSend = deepmerge(this.objToSend, data);
  }
  sendMes(data) {
    if (!this.sendService) {
      this.sendService = setTimeout(this.finalizeSend.bind(this), 0);
    }
    this.lazySendMes(data);
  }
  startRequest() {
    if (!this.requestActive) {
      this.startConnectionCheckService();
      this.requestActive = true;
      this.requestStart.push(new Date().getTime());
      this.onReqInit();
    }
    return ++this.startedRequestId;
  }
  endRequest(id) {
    if (id == this.completedRequestId + 1) {
      ++this.completedRequestId;
      this.lastRequestDuration =
        new Date().getTime() - this.requestStart.shift();
      this.lazySendMes({ delays: [this.lastRequestDuration] });
    }
    if (this.completedRequestId == this.startedRequestId) {
      this.startConnectionCheckService();
      this.requestActive = false;
      this.onReqEnd();
    }
  }
  activeRequestDuration() {
    return this.requestActive
      ? new Date().getTime() - this.requestStart[0]
      : -1;
  }
  close() {
    this.stopConnectionCheckService();
    if (this.requestActive) {
      this.lastRequestDuration =
        new Date().getTime() - this.requestStart.shift();
      this.requestActive = false;
      this.onReqEnd();
    }
  }
  greetServer(nick, tableId, roleRequest) {
    this.sendMes({ nick: nick, request: true, subscribeTable: { id: tableId, roleRequest } });
  }
  request() {
    this.sendMes({ request: true });
  }
  async requestArmySpawner(name, left, top, game) {
    const data = await game.getArmyRes(name);
    this.sendMes({
      getArmySpawner: { name, left, top, data },
      request: true,
    });
  }
  requestNextToken(spawnerId, posX, posY, userId) {
    this.sendMes({
      nextToken: {
        spawnerId: spawnerId,
        left: posX,
        top: posY,
        userId: userId,
      },
      request: true,
    });
  }
  requestTokenByRes(spawnerId, res, posX, posY, userId) {
    this.sendMes({
      nextToken: {
        spawnerId: spawnerId,
        res: res,
        left: posX,
        top: posY,
        userId: userId,
      },
      request: true,
    });
  }
  requestUtility(data) {
    this.sendMes({
      getUtil: data,
      request: true,
    });
  }
  requestFlip(objs) {
    this.sendMes({ flipObjs: objs, request: true });
  }
  requestDelete(objs) {
    this.sendMes({ delObjs: objs, request: true });
  }
  requestLeftRotate(objs) {
    this.sendMes({ rotateLeftObjs: objs, request: true });
  }
  requestRightRotate(objs) {
    this.sendMes({ rotateRightObjs: objs, request: true });
  }
  requestTableClear() {
    this.sendMes({ clearTable: "", request: true });
  }
  requestEmote(name, posX, posY) {
    this.sendMes({
      emote: { left: posX, top: posY, type: name },
      request: true,
    });
  }
  requestUndo() {
    this.sendMes({ undo: 1, request: true });
  }
  requestRedo() {
    this.sendMes({ redo: 1, request: true });
  }
  requestSetTable(newTable) {
    try {
      const data = JSON.parse(newTable);
      this.sendMes({ setTable: data, request: true });
    } catch (e) {
      // gameConsole.print('Error: unable to parse save file.', 'red');
    }
  }
  requestUserPromote(id) {
    this.sendMes({ promoteUser: id, request: true });
  }
  requestUserDemote(id) {
    this.sendMes({ demoteUser: id, request: true });
  }
  requestMove(changes) {
    this.sendMes({ move: changes, request: true });
  }
  requestReturn(objs) {
    this.sendMes({ returnObjs: objs, request: true });
  }
  requestReveal(objs) {
    this.sendMes({ revealObjs: objs, request: true });
  }
  informActive() {
    this.sendMes({ updateStatus: [{ active: true }], request: true });
  }
  informInactive() {
    this.sendMes({ updateStatus: [{ active: false }], request: true });
  }
  hintMousePos(mousePos) {
    this.sendMes({
      hint: {
        mousePos: {
          left: Math.round(mousePos.left),
          top: Math.round(mousePos.top),
        },
      },
    });
  }
  hintGrab(objs) {
    this.sendMes({ hint: { grab: objs } });
  }
  hintDrop() {
    this.sendMes({ hint: { drop: true } });
  }
  text(mes) {
    this.sendMes({ text: { content: mes } });
  }
}
