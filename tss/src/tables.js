const Table = require("./table.js");
const fs = require("fs").promises;

module.exports = class Tables {
  constructor(storage, serviceQuality, mainAgent) {
    this.storage = storage;
    this.serviceQuality = serviceQuality;
    this.mainAgent = mainAgent;
    this.tables = new Map();
    this.subscribers = new Set();
  }
  async load(id) {
    const newTable = new Table(
      id,
      this.serviceQuality,
      this.getTablePath(id),
      this.storage,
      (change) => {
        const mes = JSON.stringify(change);
        this.subscribers.forEach((user) => user.send(mes));
      },
      this.unload.bind(this),
      this.mainAgent,
    );
    if (!await newTable.load()) {
      return false;
    }
    this.tables.set(id, newTable);
    if (this.subscribers.size > 0) {
      const mes = JSON.stringify({
        addTable: newTable.getInfo(),
      });
      this.subscribers.forEach((sub) => sub.send(mes));
    }
    return true;
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
      if (!(await this.load(id))) {
        ws.send(JSON.stringify({ table: false }));
        return
      }
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
  async getFreshId() {
    const { nanoid } = await import("nanoid");
    for (; ;) {
      const id = nanoid(12);
      try {
        await fs.access(this.getTablePath(id));
        // If no error, file exists, try another id
      } catch (error) {
        // Id is unique
        return id;
      }
    }
  }
  async createTable(boardName) {
    try {
      const id = await this.getFreshId();
      const tablePath = this.getTablePath(id);
      const file = await fs.open(tablePath, "wx");
      if (boardName !== undefined) {
        await file.write(JSON.stringify({ act: { board: boardName } }) + '\n');
      }
      await file.close();
      return id;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
  getTablePath(id) {
    return `tables/${id}`;
  }
};
