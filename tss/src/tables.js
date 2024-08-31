const Table = require("./table.js");

module.exports = class Tables {
  constructor(storage, serviceQuality, mainAgent) {
    this.storage = storage;
    this.serviceQuality = serviceQuality;
    this.mainAgent = mainAgent;
    this.tables = new Map();
    this.subscribers = new Set();
  }
  load(id, name, defPlayersNum = 2, boardName) {
    const newTable = new Table(
      id,
      name,
      defPlayersNum,
      this.serviceQuality,
      boardName,
      `tables/${id}`,
      this.storage,
      (change) => {
        const mes = JSON.stringify(change);
        this.subscribers.forEach((user) => user.send(mes));
      },
      this.unload.bind(this),
      this.mainAgent,
    );
    this.tables.set(id, newTable);
    if (this.subscribers.size > 0) {
      const mes = JSON.stringify({
        addTable: newTable.getInfo(),
      });
      this.subscribers.forEach((sub) => sub.send(mes));
    }
  }
  unload(table) {
    this.tables.delete(table.id);
    if (this.subscribers.size > 0) {
      const mes = JSON.stringify({
        removeTable: { id: table.id },
      });
      this.subscribers.forEach((sub) => sub.send(mes));
    }
  }
  setServiceQuality(newQuality) {
    this.serviceQuality = newQuality;
    [...this.tables.values()].forEach((table) =>
      table.setServiceQuality(newQuality),
    );
  }
  subscribe(ws) {
    this.subscribers.add(ws);
    ws.userData.tableId = -1;
    ws.on("close", () => this.subscribers.delete(ws));
    ws.send(
      JSON.stringify({
        tables: [...this.tables.values()].map((el) => el.getInfo()),
      }),
    );
  }
  async subscribeTable(ws, id, roleRequest) {
    if (!this.tables.has(id)) {
      const table = await this.mainAgent.getTableById(id);
      if (!table) {
        ws.send(JSON.stringify({ table: false }));
        return
      }
      this.load(id, table.name, table.defNumOfPlayers, table.board);
    }
    if (!(await this.tables.get(id).addUser(ws, roleRequest))) {
      ws.send(JSON.stringify({ table: false }));
    }
  }
  getSubscriptionsNum() {
    return [...this.tables.values()].reduce(
      (acc, el) => (acc += el.subscribers.size),
      0,
    );
  }
  getActivePlayersNum() {
    return [...this.tables.values()].reduce(
      (acc, el) => (acc += el.players.size),
      0,
    );
  }
};
