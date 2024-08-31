const { promisify } = require("util");
const fs = require("fs");
const { QUALITY_LEVELS } = require("./config");
const shuffle = require("./shuffle");

const OBJ = 1;
const TOKEN = 2;
const SPAWNER = 3;

const ROLE_OWNER = 1;
const ROLE_PLAYER = 2;
const ROLE_SPECTATOR = 3;

const TABLE_REMOVAL_DELAY = 60 * 60 * 1000;

const TABLE_DUMP_TIMEOUT = 10000;

const ARMY_TOKENS_LIMIT = 100;

const TABLE_MAX_NUMBER_OF_OBJS = 500;

const errToMany = (type) => `'Error in army config: it has to many ${type}.'`;

class ActionError extends Error { }

module.exports = class Table {
  constructor(
    id,
    name,
    defaultPlayersNum,
    quality,
    boardName,
    dumpFilePath,
    storage,
    onChangeDescription,
    onRemove,
    mainAgent,
  ) {
    this.dumpBuffer = "";
    this.dumpService = undefined;
    this.id = id;
    this.name = name;
    this.content = [];
    this.history = [];
    this.future = [];
    this.chatData = [];
    this.owners = new Set();
    this.players = new Set();
    this.subscribers = new Set();
    this.defaultPlayersNum = defaultPlayersNum;
    this.actualQuality = 0;
    this.setServiceQuality(quality);
    this.boardName = boardName;
    this.startRemovalService();
    this.storage = storage;
    this.onChangeDescription = onChangeDescription;
    this.onRemove = onRemove;
    this.secrets = new Map();
    this.mainAgent = mainAgent;

    if (typeof dumpFilePath === "string") {
      this.dumpFilePath = dumpFilePath;
      this.dumpFileLines = 1;
      (async () => {
        let loadingError;
        if ((loadingError = !(await this.loadFromDumpFile(dumpFilePath)))) {
          console.log("error occurred during table loading");
        }
        this.initDumping(dumpFilePath);
        if (this.lastLineNotEmpty === true) {
          this.outStream.write("\n");
          ++this.dumpFileLines;
        }
        if (loadingError) {
          const prevLine =
            this.history[this.history.length - 1]?.place.line ?? -1;
          this.dump(`${JSON.stringify({ prev: { line: prevLine } })}\n`, true);
        }
      })();
    }
  }
  async loadFromDumpFile(path, line = -1, lockedFiles = new Set()) {
    if (lockedFiles.has(path)) {
      console.log(`error file ${path}, has been already referenced, aborting`);
      return false;
    }
    lockedFiles.add(path);
    let success = true;
    try {
      const content = await promisify(fs.readFile)(path, "utf8");
      const entires = content.split("\n");
      if (line === -1 && lockedFiles.size === 1) {
        this.dumpFileLines = entires.length;
        this.lastLineNotEmpty = entires[entires.length - 1] !== "";
        line = entires.length - 1;
      }
      const tableEntries = [];
      while (line !== -1) {
        if (typeof line !== "number") {
          console.log(`error line no not numeric, aborting`);
          return false;
        }
        if (entires[line] == "") {
          --line;
          continue;
        }
        try {
          const entry = JSON.parse(entires[line]);
          if (entry.act !== undefined) {
            tableEntries.push({
              act: entry.act,
              place: { line: line, file: path },
            });
          }
          const prevLine = entry?.prev?.line;
          const prevFile = entry?.prev?.file;
          if (prevFile !== undefined && prevFile !== path) {
            if (
              !(await this.loadFromDumpFile(prevFile, prevLine, lockedFiles))
            ) {
              return false;
            }
            break;
          }
          if (prevLine !== undefined) {
            if (prevLine >= line) {
              throw new Error("invalid prev line value");
            }
            line = prevLine;
          } else --line;
        } catch (err) {
          console.log(
            `error (${err}) in line no ${line} in file ${path}, starting again from line ${line - 1}`,
          );
          success = false;
          --line;
          tableEntries.length = 0;
        }
      }
      for (let i = 0; i < tableEntries.length; ++i) {
        const el = tableEntries[tableEntries.length - 1 - i];
        try {
          await this.execute(el.act, { type: 3, place: el.place });
        } catch (err) {
          console.log(err);
          console.log(JSON.stringify(el));
          return false;
        }
      }
      return success;
    } catch (err) {
      console.log(err);
      if (err.code !== "ENOENT") {
        this.storage.logEvent("tableLoading", {
          place: "tableLoading",
          err: err,
        });
        return line === -1 && lockedFiles.size === 1;
      }
    }
  }
  initDumping(path) {
    this.outStream = fs.createWriteStream(path, { flags: "a" });
    this.outStream?.on?.("error", (err) => {
      this.storage.logEvent("tableDumpError", {
        place: "tableDumpWriting",
        err: err,
      });
      this.outStream = undefined;
    });
  }
  dump(text, important = false) {
    this.dumpBuffer += text;
    if (this.outStream !== undefined) {
      if (important) {
        this.writeDumpBufferToFile();
      } else if (this.dumpService === undefined) {
        console.log("initialize saving");
        this.dumpService = setTimeout(
          this.writeDumpBufferToFile.bind(this),
          TABLE_DUMP_TIMEOUT,
        );
      }
    }
  }
  writeDumpBufferToFile() {
    if (this.dumpService !== undefined) {
      clearTimeout(this.dumpService);
      this.dumpService = undefined;
    }
    if (this.outStream !== undefined) {
      console.log("saving table state");
      this.outStream?.write?.(this.dumpBuffer);
      this.dumpBuffer = "";
    }
  }
  startRemovalService() {
    this.removalService = setTimeout(() => {
      this.remove();
    }, TABLE_REMOVAL_DELAY);
  }
  stopRemovalService() {
    if (this.removalService !== undefined) {
      clearTimeout(this.removalService);
      this.removalService = undefined;
    }
  }
  remove() {
    this.sendAll({ close: true });
    this.onRemove(this);
    if (this.outStream !== undefined) {
      if (this.dumpBuffer.length > 0) {
        this.writeDumpBufferToFile();
      }
      setTimeout(() => {
        this.outStream.close();
      }, 1000);
    }
  }
  /**
   * Wysyła wiadomość do wszystkich graczy oglądających stół.
   *
   * @param {*} data dane do wysłania
   * @param {*} onlyActive określa czy wysyłać wiadomość tylko do aktywnych użytkowników
   */
  sendAll(data, onlyActive = false) {
    const mes = JSON.stringify(data);
    this.subscribers.forEach((user) => {
      if (!onlyActive || user.userData.active) user.send(mes);
    });
  }
  /**
   * Wysyła wiadomość do wszystkich graczy oglądających stół, oprócz wyszczególnionego.
   *
   * @param {*} data dane do wysłania
   * @param {*} ws socket gracza, do którego wiadomość jest niewysyłana
   * @param {*} onlyActive określa czy wysyłać wiadomość tylko do aktywnych użytkowników
   */
  sendOthers(data, ws, onlyActive = false) {
    const mes = JSON.stringify(data);
    this.subscribers.forEach((user) => {
      if ((!onlyActive || user.userData.active) && user !== ws) user.send(mes);
    });
  }
  warnAndRaise(mes) {
    throw new ActionError(mes);
  }
  pushContent(obj) {
    if (this.content.length >= TABLE_MAX_NUMBER_OF_OBJS) {
      this.warnAndRaise(
        "Error: too many objects has been created on this table. Clear it or create new table.",
      );
    }
    this.content.push(obj);
  }
  addObj(obj, addInfo = null) {
    if (obj.id === undefined) obj.id = this.content.length;
    if (obj.type === undefined) obj.type = obj.flipped !== undefined
      ? OBJ
      : obj.tokens !== undefined
        ? SPAWNER
        : TOKEN;
    this.pushContent(obj);
    if (addInfo != null) addInfo.push(obj);
    return obj.id;
  }
  addUnit(
    res,
    flipped,
    left,
    top,
    angle,
    addInfo = null,
    spawnerId = undefined,
  ) {
    return this.addObj(
      {
        type: OBJ,
        left: left,
        top: top,
        res: res,
        flipped: flipped,
        angle: angle,
        spawnerId,
      },
      addInfo,
    );
  }
  addToken(
    res,
    left,
    top,
    addInfo = null,
    secret = undefined,
    secretsInfo = undefined,
  ) {
    const obj = {
      id: this.content.length,
      type: TOKEN,
      left: left,
      top: top,
      res: res,
      secret: secret,
    };
    if (secret !== undefined) {
      obj.secret = true;
      obj.res = secret;
      this.secrets.set(obj.id, res);
      if (secretsInfo !== undefined) secretsInfo.push([obj.id, res]);
    }
    this.pushContent(obj);
    if (addInfo != null) addInfo.push(obj);
  }
  addSpawner(tokens, left, top, addInfo = null) {
    const obj = {
      id: this.content.length,
      type: SPAWNER,
      left: left,
      top: top,
      tokens: tokens,
    };
    this.pushContent(obj);
    if (addInfo != null) addInfo.push(obj);
  }
  safeRepeat(data, mapper, limit, errMessage) {
    const count = data.reduce((acc, el) => acc + el.q, 0);
    if (count > limit) {
      this.warnAndRaise(errMessage);
    }
    return data.flatMap((el) => Array(el.q).fill(mapper(el)));
  }
  async _addArmy(options, hist, method) {
    const info = await this.mainAgent.getArmy(options.name);

    if (info.defBackImg === undefined) {
      info.defBackImg = "b.jpg";
    }

    const prefix = `armies/${options.name}/`;
    const tokens = this.safeRepeat(
      info.tokens,
      (el) => prefix + el.name,
      ARMY_TOKENS_LIMIT,
      errToMany("tokens"),
    );

    if (options.removedTokens !== undefined) {
      options.removedTokens.forEach((el) => {
        const index = tokens.findIndex((token) => token == el);
        if (index == -1)
          this.warnAndRaise(
            "Error in army config: it has invalid removedTokens param",
          );
        tokens.splice(index, 1);
      });
    }

    const addInfo = [];
    const secretsInfo = [];
    method(tokens, addInfo);

    const identity = (el) => el;
    this.safeRepeat(info.bases, identity, 10, errToMany("bases")).forEach(
      (el) => {
        this.addUnit(
          prefix + el.name,
          false,
          options.left,
          options.top,
          0,
          addInfo,
        );
      },
    );

    if (info.markers !== undefined) {
      const markers = this.safeRepeat(
        info.markers,
        identity,
        100,
        errToMany("markers"),
      );
      if (markers.some((el) => el.secret)) {
        shuffle(markers);
      }
      markers.forEach((el, k) => {
        const row = Math.floor(k / 8);
        this.addToken(
          prefix + el.name,
          options.left +
          ((k % 8) - Math.min(markers.length - 1 - row, 7) / 2) * 40,
          options.top + 120 + row * 60,
          addInfo,
          el.secret ? prefix + el.secret : undefined,
          secretsInfo,
        );
      }, this);
    }

    this.sendAll({ addContent: addInfo });

    this.addHistory(
      hist,
      { addObjs: addInfo, secretsInfo },
      { delObjs: addInfo.map((el) => el.id) },
    );
  }
  async addArmySpawner(hist, options) {
    await this._addArmy(options, hist, (tokens, addInfo) => {
      this.addSpawner(tokens, options.left, options.top - 100, addInfo);
    });
  }
  addUtil(hist, data) {
    const addInfo = [];
    this.addObj(data, addInfo);

    this.sendAll({ addContent: addInfo });

    this.addHistory(
      hist,
      { addObjs: addInfo },
      { delObjs: addInfo.map((el) => el.id) },
    );
  }
  nextToken(hist, data) {
    const obj = this.content[data.spawnerId];
    if (obj !== undefined && obj.type == SPAWNER && obj.tokens.length > 0) {
      const tokenId =
        data.res !== undefined
          ? obj.tokens.indexOf(data.res)
          : Math.floor(Math.random() * obj.tokens.length);
      if (tokenId < 0) {
        return;
        // ws.send(JSON.stringify({warn: {content: 'Error: Selected tokens seems to not exists'}}));
      }
      const token = obj.tokens[tokenId];
      const newId = this.addUnit(
        token,
        false,
        data.left,
        data.top,
        0,
        null,
        data.spawnerId,
      );
      obj.tokens.splice(tokenId, 1);

      this.sendAll({
        nextToken: {
          spawnerId: data.spawnerId,
          tokenId: tokenId,
          left: data.left,
          top: data.top,
          newId: newId,
          userId: data.userId,
        },
      });

      this.addHistory(
        hist,
        {
          depopulateSpawner: {
            spawnerId: data.spawnerId,
            objs: [this.content[newId]],
          },
        },
        { populateSpawner: { spawnerId: data.spawnerId, objs: [newId] } },
        true,
      );
      if (data.res !== undefined) {
        this.warn(`Warning: Player has selected token from a spawner.`);
      }
    }
  }
  populateSpawner(hist, data) {
    if (hist.type == 1)
      this.warn(`Warning: Player has redone returning token to a spawner.`);
    if (hist.type == 2)
      this.warn(
        `Warning: Player has undone drawing random token from a spawner.`,
      );
    const obj = this.content[data.spawnerId];
    if (obj !== undefined && obj.type == SPAWNER) {
      const deletedTokens = [];
      data.objs.forEach((el) => {
        const token = this.content[el];
        obj.tokens.push(token.res);
        deletedTokens.push(token);
        this.content[el] = undefined;
      });
      this.sendAll({
        populateSpawner: { spawnerId: data.spawnerId, objs: data.objs },
      });
      this.addHistory(
        hist,
        { populateSpawner: { spawnerId: data.spawnerId, objs: data.objs } },
        {
          depopulateSpawner: { spawnerId: data.spawnerId, objs: deletedTokens },
        },
      );
    }
  }
  depopulateSpawner(hist, data) {
    if (hist.type == 1)
      this.warn(
        `Warning: Player has redone drawing token from spawner. Obtained token isn't selected at random. Instead token from the previous draw is obtained.`,
      );
    if (hist.type == 2)
      this.warn(`Warning: Player has undone returning token to a spawner.`);
    const obj = this.content[data.spawnerId];
    if (obj !== undefined && obj.type == SPAWNER) {
      data.objs.forEach((el) => {
        obj.tokens.splice(
          obj.tokens.findIndex((token) => token == el.res),
          1,
        );
        this.content[el.id] = el;
      });
      this.sendAll({
        depopulateSpawner: { spawnerId: data.spawnerId, objs: data.objs },
      });
      this.addHistory(
        hist,
        { depopulateSpawner: { spawnerId: data.spawnerId, objs: data.objs } },
        {
          populateSpawner: {
            spawnerId: data.spawnerId,
            objs: data.objs.map((el) => el.id),
          },
        },
      );
    }
  }
  addHistory({ type, place }, action, revAction, important = false) {
    if (type == 2) {
      this.future.push({ place: place, act: revAction });
      if (this.outStream !== undefined) {
        const actual = this.history[this.history.length - 1] ?? {
          place: { line: -1 },
        };
        this.dump(
          `${JSON.stringify({ prev: this.simplifyPlace(actual.place) })}\n`,
          important,
        );
        ++this.dumpFileLines;
      }
    } else {
      this.history.push({ place: place, act: revAction });
      if (type == 0) {
        if (this.outStream !== undefined) {
          const prev = this.history[this.history.length - 2] ?? {
            place: { line: -1 },
          };
          this.dump(
            `${JSON.stringify({ prev: this.simplifyPlace(prev.place), act: action })}\n`,
            important,
          );
          ++this.dumpFileLines;
        }
        this.future = [];
      } else if (type == 1) {
        if (this.outStream !== undefined) {
          this.dump(
            `${JSON.stringify({ prev: this.simplifyPlace(this.history[this.history.length - 1].place) })}\n`,
            important,
          );
          ++this.dumpFileLines;
        }
      }
    }
  }
  simplifyPlace(place) {
    if (place.file === undefined || place.file === this.dumpFilePath) {
      if (place.line === undefined || place.line === this.dumpFileLines - 2)
        return undefined;
      else return { line: place.line };
    } else return place;
  }
  clearTable(hist) {
    if (this.content.length > 0) {
      this.addHistory(
        hist,
        { clearTable: true },
        { addObjs: this.content.filter((el) => el !== undefined) },
      );

      this.content = [];
      // log(`INFO: Table have been cleared.`);
      this.sendAll({ clearTable: "" });
    }
  }
  setTable(hist, data) {
    this.clearTable(hist);
    data.forEach((el) => {
      this.content[el.id] = el;
      this.content[el.id].type =
        el.flipped !== undefined
          ? OBJ
          : el.tokens !== undefined
            ? SPAWNER
            : TOKEN;
    }, this);
    this.sendAll({ addContent: this.content });
    this.addHistory(
      hist,
      { setTable: data },
      { delObjs: data.map((el) => el.id) },
    );
  }
  updateContent(hist, updates, move = false) {
    const changes = [];

    updates.forEach(function (el) {
      changes.push({ id: el.id });
      for (const prop in el) {
        if (Object.prototype.hasOwnProperty.call(el, prop)) {
          changes[changes.length - 1][prop] = this.content[el.id][prop];
          this.content[el.id][prop] = el[prop];
        }
      }
    }, this);
    this.sendAll(move ? { move: updates } : { updateContent: updates });
    this.addHistory(
      hist,
      { updateContent: updates },
      { updateContent: changes },
    );
  }
  delObjs(hist, ids) {
    this.addHistory(
      hist,
      { delObjs: ids },
      { addObjs: ids.map((id) => this.content[id]) },
    );

    ids.forEach((id) => {
      this.content[id] = undefined;
    }, this);
    this.sendAll({ delObjs: ids });
  }
  returnObjs(hist, ids) {
    ids.forEach((id) => {
      const spawnerId = this.content?.[id]?.spawnerId;
      if (spawnerId !== undefined)
        this.populateSpawner(hist, { spawnerId: spawnerId, objs: [id] });
    }, this);
    this.warn(`Warning: Player has returned token(s) to spawner.`);
  }
  flipObjs(hist, ids) {
    const flips = [];
    ids.forEach(function (id) {
      if (this.content[id] && this.content[id].type == OBJ) {
        this.content[id].flipped = !this.content[id].flipped;
        flips.push({ id: id, flipped: this.content[id].flipped });
      }
    }, this);
    this.sendAll({ updateContent: flips });

    this.addHistory(hist, { flipObjs: ids }, { flipObjs: ids });
  }
  rotateObjs(hist, ids, angle) {
    const changes = [];
    ids.forEach(function (id) {
      if (this.content[id] && this.content[id].type == OBJ) {
        this.content[id].angle += angle;
        changes.push({ id: id, angle: this.content[id].angle });
      }
    }, this);
    this.sendAll({ updateContent: changes });

    if (angle == -60)
      this.addHistory(hist, { rotateLeftObjs: ids }, { rotateRightObjs: ids });
    else
      this.addHistory(hist, { rotateRightObjs: ids }, { rotateLeftObjs: ids });
  }
  addObjs(hist, data) {
    this.sendAll({ addContent: data });
    data.forEach((el) => {
      this.content[el.id] = el;
    }, this);

    this.addHistory(
      hist,
      { addObjs: data },
      { delObjs: data.map((el) => el.id) },
    );
  }
  updateStatus(data, ws) {
    data.forEach((entry) => {
      if (entry.active != ws.userData.active) {
        ws.userData.active = entry.active;
        this.sendOthers(
          {
            updateStatus: [
              { userId: ws.userData.userId, active: entry.active },
            ],
          },
          ws,
        );
      }
    });
  }
  async execute(data, hist) {
    if (data.clearTable !== undefined) this.clearTable(hist);
    if (data.setTable !== undefined) this.setTable(hist, data.setTable);
    if (data.updateContent !== undefined)
      this.updateContent(hist, data.updateContent);
    if (data.move !== undefined) this.updateContent(hist, data.move, true);
    if (data.getArmySpawner !== undefined)
      await this.addArmySpawner(hist, data.getArmySpawner);
    if (data.nextToken !== undefined) this.nextToken(hist, data.nextToken);
    if (data.getUtil !== undefined) this.addUtil(hist, data.getUtil);
    if (data.delObjs !== undefined) this.delObjs(hist, data.delObjs);
    if (data.returnObjs !== undefined) this.returnObjs(hist, data.returnObjs);
    if (data.flipObjs !== undefined) this.flipObjs(hist, data.flipObjs);
    if (data.rotateLeftObjs !== undefined)
      this.rotateObjs(hist, data.rotateLeftObjs, -60);
    if (data.rotateRightObjs !== undefined)
      this.rotateObjs(hist, data.rotateRightObjs, 60);
    if (data.addObjs !== undefined) this.addObjs(hist, data.addObjs);
    if (data.populateSpawner !== undefined)
      this.populateSpawner(hist, data.populateSpawner);
    if (data.depopulateSpawner !== undefined)
      this.depopulateSpawner(hist, data.depopulateSpawner);
    if (data.secretsInfo !== undefined) {
      data.secretsInfo.forEach((el) => this.secrets.set(el[0], el[1]));
    }
  }
  async undo(ws) {
    if (this.history.length > 0) {
      const obj = this.history.pop();
      await this.execute(obj.act, { type: 2, place: obj.place });
    }
  }
  async redo(ws) {
    if (this.future.length > 0) {
      const obj = this.future.pop();
      await this.execute(obj.act, { type: 1, place: obj.place });
    }
  }
  chat(mes, user) {
    this.chatData.push({ autor: user.userName, content: mes });
    this.sendAll({ text: { autor: user.userName, content: mes } });
  }
  warn(mes) {
    this.sendAll({ warn: { content: mes } });
  }
  updateUsers(ids) {
    this.sendAll({
      updateUsers: ids.map((id) => {
        const user = [...this.subscribers].find(
          (user) => user.userData.userId == id,
        );
        return { userId: user.userData.userId, role: user.userData.role };
      }),
    });
  }
  promoteUser(userId) {
    const userToPromote = [...this.subscribers].find(
      (user) => user.userData.userId == userId,
    );
    if (userToPromote && !this.owners.has(userToPromote)) {
      if (this.players.has(userToPromote)) {
        this.owners.add(userToPromote);
        userToPromote.userData.role = ROLE_OWNER;
        this.updateUsers([
          userToPromote.userData.userId,
        ]);
      } else {
        this.addPlayer(userToPromote);
        userToPromote.userData.role = ROLE_PLAYER;
        // log(`INFO: User ${userInfo(userToPromote.userData)} have been promoted.`);
        this.updateUsers([userToPromote.userData.userId]);
      }
    }
  }
  demoteUser(userId) {
    const userToDemote = [...this.subscribers].find(
      (user) => user.userData.userId == userId,
    );
    if (userToDemote && !this.owners.has(userToDemote)) {
      this.removePlayer(userToDemote);
      userToDemote.userData.role = ROLE_SPECTATOR;
      // log(`INFO: User ${userInfo(userToDemote.userData)} have been demoted.`);
      this.updateUsers([userToDemote.userData.userId]);
    }
  }
  hintMousePos(data, ws) {
    this.sendOthers(
      {
        hint: {
          mousePos: {
            userId: ws.userData.userId,
            left: data.left,
            top: data.top,
          },
        },
      },
      ws,
      true,
    );
  }
  revealObjs(ids, ws) {
    const changes = [];

    ids.forEach((id) => {
      const secret = this.secrets.get(id);
      if (secret !== undefined) {
        changes.push({ id: id, data: secret });
      }
    }, this);
    if (changes.length > 0) {
      ws.send(JSON.stringify({ revealObjsDetails: changes }));
      this.warn(
        `Warning: Player ${ws.userData.userName} has revealed secret(s).`,
      );
      this.sendAll({ revealObjs: ids });
    }
  }
  async handleMessage(data, ws) {
    try {
      if (this.owners.has(ws)) {
        if (data.promoteUser !== undefined) this.promoteUser(data.promoteUser);
        if (data.demoteUser !== undefined) this.demoteUser(data.demoteUser);
        if (data.getLabel !== undefined) this.getLabel(ws);
      }
      if (this.players.has(ws)) {
        await this.execute(data, {
          type: 0,
          place: { line: this.dumpFileLines - 1 },
        });
        if (data.revealObjs !== undefined) {
          this.revealObjs(data.revealObjs, ws);
        }
        if (data.hint !== undefined) {
          if (data.hint.mousePos !== undefined)
            this.hintMousePos(data.hint.mousePos, ws);
          if (data.hint.grab !== undefined) {
            this.sendOthers(
              {
                hint: {
                  grab: { userId: ws.userData.userId, objs: data.hint.grab },
                },
              },
              ws,
              true,
            );
          }
          if (data.hint.drop !== undefined) {
            this.sendOthers(
              { hint: { drop: { userId: ws.userData.userId } } },
              ws,
              true,
            );
          }
        }
        if (data.emote !== undefined) {
          const imgs = data.emote.type.image;
          const randomness = Array.isArray(imgs) ? Math.floor(Math.random() * imgs.length) : 0;
          this.sendAll({
            emote: Object.assign({}, data.emote, { randomness })
          });
        }
        if (data.undo !== undefined) await this.undo(ws);
        if (data.redo !== undefined) await this.redo(ws);
        if (data.updateStatus !== undefined) {
          this.updateStatus(data.updateStatus, ws);
        }
      }
      if (data.text !== undefined) this.chat(data.text.content, ws.userData);
    } catch (err) {
      if (err instanceof ActionError) {
        ws.send(JSON.stringify({ warn: { content: err.message } }));
      } else {
        throw err;
      }
    }
  }
  async addUser(ws, roleRequest) {
    const authInfo = await this.mainAgent.authorizeRoleRequest(ws, this.id, roleRequest);
    if (!authInfo.result) {
      return false;
    }
    if (authInfo.role == "owner") {
      this.addPlayer(ws)
      ws.userData.role = ROLE_OWNER;
      this.owners.add(ws);
    } else if (authInfo.role == "player") {
      this.addPlayer(ws)
      ws.userData.role = ROLE_PLAYER;
    } else if (authInfo.role == "spectator") {
      ws.userData.role = ROLE_SPECTATOR;
    } else {
      return false;
    }

    this.sendAll({ addUsers: [ws.userData] });

    this.subscribers.add(ws);

    ws.send(
      JSON.stringify({
        yourId: ws.userData.userId,
        addContent: this.content,
        addUsers: [...this.subscribers].map((user) => ({
          userId: user.userData.userId,
          userName: user.userData.userName,
          role: user.userData.role,
          active: user.userData.active,
        })),
        qualityInfo: QUALITY_LEVELS[this.actualQuality],
        tableInfo: { board: this.boardName },
      }),
    );
    this.adjustLocalQuality();

    this.stopRemovalService();
    // log(`INFO: User ${userInfo(ws.userData)} have been added.`);
    ws.userData.tableId = this.id;
    const prev = ws.onMessage;
    ws.onMessage = async (ws, data) => {
      prev(ws, data);
      await this.handleMessage(data, ws);
    };
    ws.on("close", () => this.removeUser(ws));
    return true;
  }
  removeUser(ws) {
    this.owners.delete(ws);
    this.removePlayer(ws);
    this.subscribers.delete(ws);
    this.sendAll({ delUsers: [ws.userData] });
    this.adjustLocalQuality();

    if (this.subscribers.size == 0) this.startRemovalService();
  }
  addPlayer(ws) {
    if (!this.players.has(ws)) {
      this.players.add(ws);
      this.onChangeDescription({
        addPlayer: {
          tableId: this.id,
          player: { id: ws.userData.userId, name: ws.userData.userName },
        },
      });
    }
  }
  removePlayer(ws) {
    if (this.players.delete(ws)) {
      this.onChangeDescription({
        removePlayer: {
          tableId: this.id,
          playerId: ws.userData.userId,
        },
      });
    }
  }
  adjustLocalQuality() {
    const qualityDecrease = Math.floor(Math.log2(this.subscribers.size + 1));
    const newQuality = Math.max(
      0,
      Math.min(QUALITY_LEVELS.length - 1, this.globalQuality - qualityDecrease),
    );
    if (newQuality != this.actualQuality) {
      this.actualQuality = newQuality;
      this.sendAll({ qualityInfo: QUALITY_LEVELS[newQuality] });
    }
  }
  setServiceQuality(globalQuality) {
    this.globalQuality = globalQuality;
    this.adjustLocalQuality();
  }
  getLabel(ws) {
    let name = false;
    try {
      if (this.dumpFilePath !== undefined) {
        name =
          this.storage.getTableLabel(this.id, this.dumpFileLines - 1) ||
          this.storage.addTableLabel(this.id, this.dumpFileLines - 1);
      }
    } catch (err) {
      console.log(err);
    }
    ws.send(JSON.stringify({ labelName: name }));
  }
  addLabel() {
    try {
      if (this.dumpFilePath !== undefined) {
        this.writeDumpBufferToFile();
        return this.storage.addTableLabel(this.id, this.dumpFileLines - 1);
      }
    } catch (err) {
      console.log(err);
    }
    return false;
  }
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      defPlayersNum: this.defaultPlayersNum,
      players: [...this.players].map((player) => {
        return { id: player.userData.userId, name: player.userData.userName };
      }),
    };
  }
};
