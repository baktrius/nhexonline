import $ from "./globalJquery.js";
import "jquery-contextmenu";
import "jquery-contextmenu/dist/jquery.contextMenu.min.css";
import "jquery-contextmenu/dist/jquery.ui.position.js";
import '../styles/game.css';

import download from "./download.js";
import upload from "./upload.js";
import ReconnectingWS from "./ReconnectingWS.js";
import ServerAgent from "./ServerAgent.js";
import SelectBox from "./SelectBox.js";
import escapeHtml from "./escapeHtml.js";
import GameConsole from "./gameConsole.js";
import TokenObj from "./TokenObj.js";
import UtilityObj from "./UtilityObj.js";
import SpawnerObj from "./SpawnerObj.js";
import Transformable from "./transformable.js";
import initContextMenu from "./contextmenu.js";

export { ReconnectingWS };

const helpMessage = `available commands:
/help - displays this help message
/helpcenter - display help center
/clear table - clears table
/clear console - clears console
/clonelink - generate link allowing others to clone current table
/joinlink - generate link allowing others to join current table`;
const roles = [" (owner)", " (player)", " (spectator)"];
const spectatorInfo =
  "You are in spectator mode!!! You can't modify table state unless the table owner changes your role.";
const SLOW_CONNECTION_INFO_TIMEOUT = 10000;

const HELP_NOTIFICATION_TIMEOUT = 20000;
const RECONNECT_NOTIFICATION_TIMEOUT = 10000;
const NEW_SPECTATOR_NOTIFICATION_TIMEOUT = 30000;
const ROLE_UPDATE_NOTIFICATION_TIMEOUT = 10000;
const INVALID_RES_TIMEOUT = -1;

const DISCONNECT_TIMEOUT = 5 * 60000;
const EPHEMERAL_NOTICE_TIMEOUT = 60000;

const names = [
  "Adam",
  "George",
  "Jerry",
  "Fred",
  "Joy",
  "Jane",
  "Elisabeth",
  "Maria",
  "Henry",
  "Richard",
];

const animals = [
  "Hedgehog",
  "Dog",
  "Giraffe",
  "Monkey",
  "Human",
  "Squirrel",
  "Moose",
  "Mule",
  "Mouse",
  "Ladybug",
  "Dolphin",
  "Cat",
];

class GameGui {
  constructor() {
    this.loaderEl = $("#loaderWrapper");
    this.loaderHidden = true;
  }
  showLoader() {
    if (this.loaderHidden) {
      this.loaderEl.show();
      this.loaderHidden = false;
    }
  }
  hideLoader() {
    if (!this.loaderHidden) {
      this.loaderEl.hide();
      this.loaderHidden = true;
    }
  }
  printDuration(duration) {
    $("#durationInfo").text(`${duration}ms`);
  }
}

export default function mount(el, tableId, resources, roleRequest, getConnection, serverInfo) {
  el = $(el);
  el.html(`
<div id="game">
<div class="infoSpace">
  <div id="tableInfo" class="focusable">Fetching server info...</div>
  <div class="notifications"></div>
</div>
<div id="loaderWrapper">
  <div class="loader"></div>
</div>
</div>`);
  return new Game(tableId, serverInfo, el.children("#game"), resources, roleRequest, getConnection);
}

function arraysEq(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }

  return true;
}

class Game {
  constructor(tableId, serverInfo, rootEl, resources, roleRequest, getConnection) {
    this.resources = resources;
    this.rootEl = rootEl;
    this.res = {};
    this.boards = [];
    this.tableId = tableId;
    this.serverInfo = serverInfo;
    this.usersSet = new Map();
    this.yourId = -1;
    this.yourRole = -1;
    this.globalFocus = null;
    this.controlKey = false;
    this.altKey = false;
    this.selectedObjs = new Set();
    this.objsLock = new Set();
    this.lastTime = new Date().getTime();
    this.lastMouseUpdate = 0;
    this.mouseUpdateService = null;
    this.notificationsEl = $(".notifications");
    this.infoEl = $("#tableInfo");
    this.objs = [];
    this.slowResponseInfoShowed = false;
    this.mouseUpdateServiceStatus = false;
    this.mouseUpdateCoolDown = 0;
    this.emotesCoolDown = -1;
    this.pageActive = true;
    this.roleRequest = roleRequest;
    this.globalAbortController = new AbortController();
    this.ws = getConnection(
      {
        onopen: (event) => {
          this.lastTime = new Date().getTime();
          this.initServerAgent();
          this.destroyContextMenu = initContextMenu(this, this.serverInfo.res.armies, this.rootEl);
        },
        onreconnect: () => {
          this.objs.forEach((obj) => {
            if (obj !== undefined) obj.remove();
          });
          this.removeNotificationsByTag("roleInfo");
          this.removeNotificationsByTag("connectionStatus");
          this.info(
            `Successfully reconnected to server.`,
            RECONNECT_NOTIFICATION_TIMEOUT,
            ["connectionStatus"],
          );
          this.lastTime = new Date().getTime();
          this.initServerAgent();
        },
        onmessage: async (event) => {
          this.lastTime = new Date().getTime();
          const data = JSON.parse(event.data);
          if (data) {
            if (data.yourId !== undefined) {
              this.yourId = data.yourId;
              this.initInfoEl();
            }
            if (data?.table === false) {
              this.removeAllNotifications();
              this.warn(
                "Table seems to not exists.",
                -1,
                ["tableError"],
                false,
              );
            }
            if (data.authorizationError !== undefined)
              this.authorizationError(data.authorizationError);
            if (data.account !== undefined) this.setAccount(data.account);
            if (data.tableInfo !== undefined)
              await this.tableInfo(data.tableInfo);
            if (data.qualityInfo !== undefined)
              this.adjustQuality(data.qualityInfo);
            if (data.nextToken !== undefined)
              await this.nextToken(data.nextToken);
            if (data.populateSpawner !== undefined)
              this.populateSpawner(data.populateSpawner);
            if (data.depopulateSpawner !== undefined)
              await this.depopulateSpawner(data.depopulateSpawner);
            if (data.addUsers !== undefined) this.addUsers(data.addUsers);
            if (data.updateUsers !== undefined)
              this.updateUsers(data.updateUsers);
            if (data.delUsers !== undefined) this.delUsers(data.delUsers);
            if (data.updateContent !== undefined)
              this.updateContent(data.updateContent);
            if (data.addContent !== undefined)
              await this.addContent(data.addContent);
            if (data.move !== undefined) this.updateContent(data.move, true);
            if (data.text !== undefined) {
              this.gameConsole.print(
                data.text.autor + ": ",
                false,
                "magenta",
              );
              this.gameConsole.print(data.text.content);
            }
            if (data.warn !== undefined)
              this.gameConsole.print(data.warn.content, true, "red");
            if (data.clearTable !== undefined) this.clearTable();
            if (data.delObjs !== undefined) this.delObjs(data.delObjs);
            if (data.hint !== undefined && this.pageActive) {
              if (data.hint.mousePos !== undefined)
                this.hintMousePos(data.hint.mousePos);
              if (data.hint.grab !== undefined)
                this.hintGrab(data.hint.grab);
              if (data.hint.drop !== undefined)
                this.hintDrop(data.hint.drop);
            }
            if (data.emote !== undefined) this.emote(data.emote);
            if (data.request !== undefined)
              this.server.endRequest(data.request);
            if (data.form !== undefined)
              this.form(data.form.name, data.form.userData);
            if (data.info !== undefined) this.showServerInfo(data.info);
            if (data.updateStatus !== undefined)
              this.updateStatus(data.updateStatus);
            if (data.labelName !== undefined) {
              const name = data.labelName;
              if (/^[A-Za-z0-9_-]{8}$/.test(name)) {
                const link = `${location.protocol}//${location.host}/clone?name=${name}`;
                this.gameConsole.print("Your clone link is:");
                this.gameConsole.print(link);
                this.formShareLink("Your table clone link", link);
              } else {
                this.gameConsole.print("Unable to generate clone link.");
              }
            }
            if (data.revealObjs) this.revealObjs(data.revealObjs);
            if (data.revealObjsDetails)
              await this.revealObjsDetails(data.revealObjsDetails);
          }
        },
        onconnectionlost: (event) => {
          this.server.close();
          this.removeNotificationsByTag(`userRole`);
          this.removeNotificationsByTag("roleUpdate");
          this.removeNotificationsByTag("roleInfo");
          this.setYourRole(3);
          this.removeNotificationsByTag("connectionStatus");
          this.delUsers(
            [...this.usersSet.keys()].map((el) => ({ userId: el })),
          );
          this.infoEl.html(`Content unavailable.`);
        },
        onreconnecting: (event) => {
          this.warn(
            `Server connection lost. Trying to reconnect...`,
            -1,
            ["connectionStatus"],
            false,
          );
        },
        onclose: (event) => {
          this.warn(
            `Connection with serwer closed`,
            -1,
            ["connectionStatus"],
            false,
          );
        },
      },
    );
    this.mouseX = 0;
    this.mouseY = 0;
    window.addEventListener("mousemove", (event) => {
      event.mvX = event.pageX - this.mouseX;
      event.mvY = event.pageY - this.mouseY;
      this.mouseX = event.pageX;
      this.mouseY = event.pageY;
    }, this.getEventConf());
    this.globalZIndex = 1;

    this.getArmyTime = 0;
    window.addEventListener("keydown", this.handleKeydown.bind(this), this.getEventConf());
    this.rootEl[0].addEventListener(
      "wheel",
      (event) => {
        if (this.selectedObjs.size > 0) {
          this.selectedObjs.forEach((el) =>
            el.objEl.triggerHandler(
              "keydown",
              event.deltaY < 0 ? "KeyA" : "KeyD",
            ),
          );
        } else if (
          this.globalFocus != null &&
          this.globalFocus.length != 0
        ) {
          this.globalFocus.triggerHandler(
            "keydown",
            event.deltaY < 0 ? "KeyA" : "KeyD",
          );
        } else {
          const delta = Math.sign(event.deltaY);
          const scaleFactor = Math.pow(0.95, delta);
          this.transformable.scale(
            scaleFactor,
            event.pageX,
            event.pageY,
          );
        }
        event.preventDefault();
      },
      { passive: false, signal: this.globalAbortController.signal },
    );
    window.addEventListener("keyup", (event) => {
      const keyCode = event.code;
      if (keyCode == "ControlLeft" || keyCode == "ControlRight")
        this.controlKey = false;
      else if (keyCode == "AltLeft" || keyCode == "AltRight")
        this.altKey = false;
    }, this.getEventConf());
    this.rootEl[0].addEventListener("mousedown", (event) => {
      if (event.button == 0) {
        if (this.globalFocus == null || this.globalFocus.length == 0) {
          if (this.altKey) this.initMouseMapMove();
          else {
            this.selectedObjs.forEach((el) => el.select());
            this.selectBox.enable(event.pageX, event.pageY);
          }
        }
      } else if (event.button == 2) this.selectBox.disable();
      else if (event.button == 1) {
        if (this.selectedObjs.size > 0) {
          this.selectedObjs.forEach((el) =>
            el.objEl.triggerHandler("keydown", "KeyW"),
          );
        } else if (
          this.globalFocus != null &&
          this.globalFocus.length != 0
        ) {
          this.globalFocus.triggerHandler("keydown", "KeyW");
        }
      }
      // event.preventDefault();
    }, this.getEventConf());
    this.gui = new GameGui();
    this.selectBox = new SelectBox(this.rootEl, (left, top, width, height) => {
      const pos1 = this.transformable.toPos({ left: left, top: top });
      const pos2 = this.transformable.toPos({
        left: left + width,
        top: top + height,
      });
      this.objs.forEach(function (el) {
        if (el) {
          if (
            el.left >= pos1.left &&
            el.left <= pos2.left &&
            el.top >= pos1.top &&
            el.top <= pos2.top
          ) {
            if (el.select && !el.selected) el.select();
          } else if (el.select && el.selected) el.select();
        }
      });
    });
    this.gameConsole = new GameConsole(
      "gameConsole",
      this.rootEl,
      this.handleInput.bind(this),
    );
    this.gameConsole.print("Press 'enter' and type '/help' for further help.");
    window.addEventListener("mouseover", (event) => {
      this.globalFocus = $(event.target).closest(".focusable");
    }, this.getEventConf());
    this.infoEl.fadeIn();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.enterInactiveState();
      else this.enterActiveState();
    }, this.getEventConf());
    this.rootEl.prepend(`
<div id="table" style='width: 0px; height: 0px'>
  <div id="layer1"></div>
  <div id="layer2"></div>
  <div id="layer3"></div>
</div>`);
    this.tableEl = $("#table");
    this.layer1El = this.tableEl.children("#layer1");
    this.layer2El = this.tableEl.children("#layer2");
    this.layer3El = this.tableEl.children("#layer3");
  }
  getEventConf() {
    return { signal: this.globalAbortController.signal };
  }
  setAccount(data) {
    if (!this.nick) {
      const urlParams = new URLSearchParams(window.location.search);
      this.nick = urlParams.get("nick");
    }
    if (data !== false && !this.nick) {
      this.nick = data.login;
    }
    if (!this.nick) {
      this.nick = `${animals[Math.floor(Math.random() * animals.length)]} ${names[Math.floor(Math.random() * names.length)]}`;
    }
    this.server.greetServer(this.nick, this.tableId, this.roleRequest);
  }
  randomArmy() {
    const armies = this.serverInfo.res.armies;
    return armies[Math.floor(Math.random() * armies.length)].id;
  }
  async getRelativeRotate() {
    return (await this.getBoardRes(this.board))?.relativeRotate ?? 0;
  }
  async getStickyPoints() {
    return (await this.getBoardRes(this.board))?.stickyPoints ?? [];
  }
  enterInactiveState() {
    // end all grabs
    this.usersSet.forEach((user) => (user.grab = undefined));
    this.pageActive = false;
    this.server.informInactive();
    this.ws.setReconnect(false);
    this.usersSet.forEach((user) => (user.grab = undefined));
    if (DISCONNECT_TIMEOUT >= 0 && !this.disconnectTimeout) {
      this.disconnectTimeout = setTimeout(() => {
        this.ws.close();
      }, DISCONNECT_TIMEOUT);
    }
    this.updateStatus([{ userId: this.yourId, active: false }]);
  }
  enterActiveState() {
    this.pageActive = true;
    this.ws.setReconnect(true);
    if (!this.ws.connected) this.ws.reconnect();
    else this.server.informActive();
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = undefined;
    }
    this.updateStatus([{ userId: this.yourId, active: true }]);
  }
  async tableInfo(info) {
    if (this.board === undefined || this.board !== info.board) {
      this.board = info.board;
      const res = await this.getBoardRes(info.board);
      this.tableEl.css("width", `${res.width + res.left * 2}px`);
      this.tableEl.css("height", `${res.height + res.top * 2}px`);
      this.tableEl.prepend(`
      <img id="mapImg" src="${this.resources.getBoardImg(info.board, res.image)}" alt="invalid res" style='
      left: ${res.left}px; top: ${res.top}px;
      width: ${res.width}px; height: ${res.height}px'>`);
      this.transformable = new Transformable(this.tableEl, 1, 25, 0, 2);
      window.addEventListener("resize", () => { this.transformable.adjust() }, this.getEventConf());
      if (this.resources.getHelp !== undefined) {
        const helpNode = $(document.createElement("div"));
        helpNode.html(
          `First time here? Click <span class='link'>here</span> for help.`,
        );
        // JQUERY EVENTS HANDLERS
        helpNode.children("span").click(this.showHelp.bind(this));
        helpNode
          .children("span")
          .click((event) => $(event.target).parent().parent().trigger("del"));
        this.info(helpNode[0], HELP_NOTIFICATION_TIMEOUT);
        // this.info(`This table is ephemeral. It will be removed from server one hour after last player leaves. If you want to keep it longer, use save option from context menu.`, EPHEMERAL_NOTICE_TIMEOUT, ['ephemeralInfo'], true);
      }
    }
  }
  showServerInfo(data) {
    const helpNode = $(document.createElement("div"));
    helpNode.html(
      data.text.replace("<!", `<span class='link'>`).replace("!>", `</span>`),
    );
    if (data.res !== undefined) {
      // JQUERY EVENTS HANDLERS
      helpNode
        .children("span")
        .click(this.form.bind(this, data.res, data.userData));
      helpNode
        .children("span")
        .click((event) => $(event.target).parent().parent().trigger("del"));
    }
    this.info(helpNode[0], data.duration || 30000);
  }
  adjustQuality(qualityInfo) {
    if (qualityInfo.mouseUpdateCoolDown <= 0 && this.mouseUpdateCoolDown >= 0) {
      this.layer3El.empty();
      this.warn(
        "Mouse sync service has been disabled, because server is overloaded.",
        10000,
      );
    }
    this.mouseUpdateCoolDown = qualityInfo.mouseUpdateCoolDown;
    this.emotesCoolDown = qualityInfo.emotesCoolDown;
    this.adjustMouseUpdateService();
  }
  enableMouseUpdateService() {
    this.mouseUpdateServiceStatus = true;
    this.mouseUpdateServiceHandler = (event) => {
      const time =
        this.lastMouseUpdate + this.mouseUpdateCoolDown - new Date().getTime();
      if (time < 0) this.sendMousePos(event.pageX, event.pageY);
      else if (this.mouseUpdateService === null) {
        this.mouseUpdateService = window.setTimeout(() => {
          this.mouseUpdateService = null;
          this.sendMousePos(event.pageX, event.pageY);
        }, time);
      }
    }
    window.addEventListener("mousemove", this.mouseUpdateServiceHandler, this.getEventConf());
  }
  disableMouseUpdateService() {
    this.mouseUpdateServiceStatus = false;
    window.removeEventListener("mousemove", this.mouseUpdateServiceHandler);
  }
  adjustMouseUpdateService() {
    let activeUsers = 0;
    this.usersSet.forEach((user) => {
      if (user.active) ++activeUsers;
    });
    if (
      this.yourRole != 3 &&
      this.mouseUpdateCoolDown > 0 &&
      activeUsers > 1 &&
      !this.mouseUpdateServiceStatus
    )
      this.enableMouseUpdateService();
    else if (
      (this.yourRole == 3 ||
        this.mouseUpdateCoolDown <= 0 ||
        activeUsers <= 1) &&
      this.mouseUpdateServiceStatus
    )
      this.disableMouseUpdateService();
    console.log(
      "mouse update service is " +
      (this.mouseUpdateServiceStatus ? "enabled" : "disabled"),
    );
  }
  initServerAgent() {
    this.server = new ServerAgent(
      this.ws,
      () => {
        this.requestCallback = setInterval(() => this.infoRequest(), 500);
      },
      this.onRequestEnd.bind(this),
    );
  }
  initMouseMapMove() {
    const handler = (event) => {
      this.transformable.move(event.mvX, event.mvY);
    }
    window.addEventListener("mousemove", handler, this.getEventConf());
    window.addEventListener("mouseup", (event) => {
      if (event.button == 0) window.removeEventListener("mousemove", handler);
    }, { signal: this.globalAbortController.signal, once: true });
  }
  formBase(title, content) {
    this.gameConsole.blur();
    this.rootEl.append(`
<div class='cover focusable'>
  <div class='globalInfo'>
    <div class='infoContent'>
      <div class='infoHead'>
        <div class="closeWrapper"><div class="closeButton">&times;</div></div>
        <h2 class="infoTitle">${title}</h2>
      </div>
      <div style='width: 100%; height: 100%'>${content}</iframe></div>
    </div>
  </div>
</div>
`);
    const coverEl = this.rootEl.children(".cover");
    coverEl.on("del", (event) => {
      $(event.target)
        .find(".globalInfo")
        .slideToggle({ complete: () => $(event.target).remove() });
    });
    // JQUERY EVENTS HANDLERS
    coverEl.find(".closeButton").click(() => coverEl.trigger("del"));
    coverEl.mousedown((event) => {
      if (event.target === coverEl[0]) {
        coverEl.one("mouseup", (event) => {
          if (event.target === coverEl[0]) coverEl.trigger("del");
        });
      }
    });
    this.rootEl.find(".globalInfo").slideToggle();
    return coverEl;
  }
  form(src, userData) {
    const coverEl = this.formBase(
      "Loading content...",
      `<iframe class='infoBody' src='${src}'>`,
    );
    coverEl.find(".infoBody").on("load", () => {
      const frameEl = $(".infoBody")[0];
      $(".infoTitle").text(frameEl.contentDocument.title);
      const childWin = frameEl.contentWindow;
      childWin.server = this.server;
      childWin.close = () => coverEl.trigger("del");
      if (userData !== undefined) childWin.userData = userData;
      if (childWin.onfinalize !== undefined) childWin.onfinalize();
    });
  }
  formShareLink(title, link) {
    this.formBase(
      title,
      `
    <input id='linkValue' type='text' value='${link}' style='width: 100%; box-sizing: border-box'>
    <button id='getLinkButton' style='width: 100%; box-sizing: border-box'>Copy to clipboard</button>`,
    );
    // JQUERY EVENTS HANDLERS
    $("#getLinkButton").click(() => {
      $("#linkValue").select();
      document.execCommand("copy");
    });
  }
  globalInfo() {
    this.form(this.resources.getHelp());
  }
  showHelp() {
    this.globalInfo();
  }
  initInfoEl() {
    this.infoEl.html(`
Table info (<span id='durationInfo'></span></span>):
<div class="content">
  Active users:
  <ul class="usersList"></ul>
</div>`);
    this.infoContentEl = this.infoEl.children(".content");
    this.usersListEl = this.infoContentEl.children(".usersList");
    // JQUERY EVENTS HANDLERS
    this.infoEl.click((event) => {
      if (event.target.tagName != "BUTTON") this.infoContentEl.slideToggle();
    });
    setTimeout(() => this.infoContentEl.slideToggle(), 0);
  }
  handleKeydown(event) {
    const keyCode = event.code;
    if (!this.isSpectator()) {
      if (keyCode == "KeyZ") this.server.requestUndo();
      else if (keyCode == "KeyY") this.server.requestRedo();
      if (!event.repeat) {
        const emote = this.serverInfo.res.emotes.find((el) => el?.keyshortcut == keyCode);
        const pos = this.transformable.toPos({
          left: this.mouseX,
          top: this.mouseY,
        });
        if (this.getArmyTime && event.timeStamp - this.getArmyTime < 2000) {
          this.getArmyTime = 0;
          // if (keyCode == "KeyW")
          //   this.server.requestUtility("common/wound", pos.left, pos.top);
        } else if (emote !== undefined) {
          this.server.requestEmote(
            emote,
            pos.left,
            pos.top,
          );
        } else if (keyCode == "Equal")
          this.transformable.scale(1.1, this.mouseX, this.mouseY);
        else if (keyCode == "Minus")
          this.transformable.scale(0.9, this.mouseX, this.mouseY);
        else if (keyCode == "KeyG") this.getArmyTime = event.timeStamp;
        else if (this.selectedObjs.size > 0) {
          this.selectedObjs.forEach((el) =>
            el.objEl.triggerHandler("keydown", keyCode),
          );
        } else if (this.globalFocus)
          this.globalFocus.triggerHandler("keydown", keyCode);
      }
    }
    if (keyCode == "Enter") {
      this.gameConsole.get(this.handleInput.bind(this));
    } else if (keyCode == "ControlLeft" || keyCode == "ControlRight")
      this.controlKey = true;
    else if (keyCode == "AltLeft" || keyCode == "AltRight") this.altKey = true;
  }
  handleInput(mes) {
    if (mes == "") this.gameConsole.blur();
    else if (mes[0] == "/") {
      this.gameConsole.print(">" + mes);
      const tokens = mes.split(" ");
      if (tokens[0] == "/help") this.gameConsole.print(helpMessage);
      else if (tokens[0] == "/helpcenter") this.showHelp();
      else if (tokens[0] == "/clear") {
        if (tokens.length == 2) {
          if (tokens[1] == "table") this.server.requestTableClear();
          else if (tokens[1] == "console") this.gameConsole.clear();
          else this.gameConsole.print("invalid parameter '" + tokens[1] + "'");
        }
      } else if (tokens[0] == "/clonelink") {
        this.gameConsole.print("Unimplemented!");
        // this.server.getLabel();
        // this.gameConsole.print("Waiting for server response...");
      } else if (tokens[0] == "/joinlink") {
        const link = `${location.protocol}//${location.host}/index.htm?join=${this.tableId}`;
        this.gameConsole.print("Your join link is");
        this.gameConsole.print(link);
        this.formShareLink("Your table join link", link);
      } else this.gameConsole.print("unrecognized command");
    } else this.server.text(mes);
  }
  sendMousePos(mouseX, mouseY) {
    if (this.mouseUpdateService !== null) {
      clearTimeout(this.mouseUpdateService);
      this.mouseUpdateService = null;
    }
    this.lastMouseUpdate = new Date().getTime();
    const inGamePos = this.transformable.toPos({ left: mouseX, top: mouseY });
    this.server.hintMousePos(inGamePos);
  }
  sendDrop(event) {
    this.server.hintDrop();
    setTimeout(() => this.sendMousePos(event.pageX, event.pageY), 0);
  }
  save() {
    download(
      "game.json",
      JSON.stringify(
        this.objs
          .filter((el) => el !== null && el !== undefined)
          .map((el) => el.save()),
      ),
    );
  }
  open() {
    upload((data) => {
      this.server.requestSetTable(data);
    }, this.globalAbortController.signal);
  }
  infoRequest() {
    const duration = this.server.activeRequestDuration();
    if (duration > 950) this.gui.showLoader();
    if (
      duration > SLOW_CONNECTION_INFO_TIMEOUT &&
      !this.slowResponseInfoShowed
    ) {
      this.slowResponseInfoShowed = true;
      this.removeNotificationsByTag("connectionStatus");
      this.warn(
        "Server is not responding for long time. Maybe connection with server has been lost.",
        -1,
        ["connectionStatus"],
      );
    }
    this.gui.printDuration(Math.max(this.server.lastRequestDuration, duration));
  }
  onRequestEnd() {
    this.gui.printDuration(this.server.lastRequestDuration);
    clearTimeout(this.requestCallback);
    this.gui.hideLoader();
    this.slowResponseInfoShowed = false;
  }
  async nextToken(data) {
    await this.objs[data.spawnerId].spawnToken(
      data.tokenId,
      data.newId,
      data.left,
      data.top,
      data.userId == this.yourId,
    );
  }
  populateSpawner(data) {
    this.objs[data.spawnerId].populate(data.objs);
    this.delObjs(data.objs);
  }
  async depopulateSpawner(data) {
    this.objs[data.spawnerId].depopulate(data.objs);
    data.objs.forEach((el) => (this.objs[el.id] = el));
    await this.addContent(data.objs);
  }
  async addContent(data) {
    const initsToAwait = [];
    for (const el of data) {
      if (el != undefined) {
        if (el.type == 1) {
          this.objs[el.id] = new TokenObj(
            this.layer1El,
            el.id,
            el.res,
            el.flipped,
            el.left,
            el.top,
            el.angle,
            this,
            el.spawnerId,
          );
        } else if (el.type == 2) {
          this.objs[el.id] = new UtilityObj(
            this.layer2El,
            el.id,
            el.res,
            el.left,
            el.top,
            this,
            el.secret,
          );
        } else if (el.type == 3) {
          this.objs[el.id] = new SpawnerObj(
            this.layer1El,
            el.id,
            el.left,
            el.top,
            el.tokens,
            this,
          );
        }
        initsToAwait.push(this.objs[el.id].init());
      }
    }
    await Promise.allSettled(initsToAwait);
  }
  setYourRole(newRole) {
    this.yourRole = newRole;
    if (this.yourRole == 1) this.infoEl.addClass("ownerPanel");
    else this.infoEl.removeClass("ownerPanel");
    if (this.yourRole == 3) {
      this.rootEl.addClass("spectatorMode");
      this.info(spectatorInfo, -1, ["roleInfo"], false);
    } else this.rootEl.removeClass("spectatorMode");
    this.adjustMouseUpdateService();
  }
  addUsers(data) {
    data.forEach(function (user) {
      this.usersSet.set(user.userId, user);
      if (user.userId == this.yourId) {
        this.setYourRole(user.role);
      }
      if (this.yourRole == 1 && user.userId != this.yourId && user.role == 3) {
        const helpNode = $(document.createElement("div"));
        helpNode.html(
          `'${escapeHtml(user.userName)}' is spectating the game. Click <span class='link'>here</span> to change his/her role to player.`,
        );
        // JQUERY EVENTS HANDLERS
        helpNode
          .children("span")
          .click(this.server.requestUserPromote.bind(this.server, user.userId));
        helpNode
          .children("span")
          .click((event) => $(event.target).parent().parent().trigger("del"));
        this.info(helpNode[0], NEW_SPECTATOR_NOTIFICATION_TIMEOUT, [
          `user${user.userId}Role`,
          "userRole",
        ]);
      }
      this.usersListEl.append(`
<li id='user${user.userId}' data-role='${user.role}' data-status='${user.active ? "active" : "inactive"}'>
  ${escapeHtml(user.userName.length > 20 ? user.userName.substring(0, 17) + "..." : user.userName)}
  <span class='owner-info'>(owner)</span>
  <span class='player-info'>(player)</span>
  <span class='spectator-info'>(spectator)</span>
  <button onclick='game.server.requestUserPromote(${user.userId})' class='promote'>+</button>
  <button onclick='game.server.requestUserDemote(${user.userId})' class='demote'>-</button>
</li>`);
    }, this);
    this.adjustMouseUpdateService();
  }
  updateUsers(data) {
    data.forEach(function (user) {
      const userEntry = this.usersSet.get(user.userId);
      userEntry.role = user.role;
      this.removeNotificationsByTag(`user${user.userId}Role`);
      if (user.userId == this.yourId) {
        this.removeNotificationsByTag(`userRole`);
        this.removeNotificationsByTag("roleUpdate");
        this.removeNotificationsByTag("roleInfo");
        this.info(
          `Your game role has been changed to ${roles[user.role - 1]}.`,
          ROLE_UPDATE_NOTIFICATION_TIMEOUT,
          ["roleUpdate"],
        );
        this.setYourRole(user.role);
      }
      this.usersListEl
        .children("#user" + user.userId)
        .attr("data-role", user.role);
      if (user.role == 3)
        this.layer3El.children("#user" + user.userId + "Mouse").remove();
    }, this);
  }
  updateStatus(data) {
    data.forEach(function (user) {
      const userEntry = this.usersSet.get(user.userId);
      userEntry.active = user.active;
      this.usersListEl
        .children("#user" + user.userId)
        .attr("data-status", user.active ? "active" : "inactive");
      if (!user.active) {
        this.layer3El.children("#user" + user.userId + "Mouse").remove();
      }
    }, this);
    this.adjustMouseUpdateService();
  }
  delUsers(data) {
    data.forEach(function (user) {
      this.usersSet.delete(user.userId);
      this.removeNotificationsByTag(`user${user.userId}Role`);
      this.usersListEl.children("#user" + user.userId).remove();
      this.layer3El.children("#user" + user.userId + "Mouse").remove();
    }, this);
    this.adjustMouseUpdateService();
  }
  updateContent(data, move = false) {
    data.forEach(function (el) {
      const obj = this.objs[el.id];
      if (!this.objsLock.has(obj)) {
        if (el.left != null || el.top != null) {
          const left = el.left != null ? el.left : obj.left;
          const top = el.top != null ? el.top : obj.top;
          obj.setPos(left, top, move ? this.mouseUpdateCoolDown : 200);
        }
      }
      if (el.angle != null) {
        this.objs[el.id].setAngle(el.angle);
      }
      if (el.flipped != null) {
        this.objs[el.id].setFlip(el.flipped);
      }
    }, this);
  }
  delObjs(data) {
    data.forEach(function (el) {
      if (this.objs[el].selected) this.objs[el].select();
      this.objs[el].remove();
      this.objs[el] = undefined;
    }, this);
  }
  clearTable() {
    this.globalZIndex = 1;
    this.globalFocus = null;
    this.objs = [];
    this.layer1El.html("");
    this.layer2El.html("");
  }
  hintMousePos(mp) {
    const user = this.usersSet.get(mp.userId);
    if (user !== undefined) {
      const mouseEl = this.layer3El.children("#user" + mp.userId + "Mouse");
      if (mouseEl.length == 0) {
        this.layer3El.append(`
<div class='mouse' id='user${mp.userId}Mouse' style='left: ${mp.left}px; top: ${mp.top}px'>
  ${escapeHtml(user.userName.length > 15 ? user.userName.substring(0, 12) + "..." : user.userName)}
</div>`);
      } else {
        mouseEl.stop(true);
        mouseEl.animate(
          { left: mp.left, top: mp.top },
          this.mouseUpdateCoolDown,
          "linear",
        );
      }
      if (user.grab !== undefined) {
        const dX = mp.left - user.left;
        const dY = mp.top - user.top;
        user.grab.forEach((elId) => {
          if (!this.objsLock.has(this.objs[elId])) {
            const el = this.objs[elId];
            el.setPos(el.left + dX, el.top + dY, this.mouseUpdateCoolDown);
          }
        }, this);
      }
      user.left = mp.left;
      user.top = mp.top;
    }
  }
  hintGrab(data) {
    const user = this.usersSet.get(data.userId);
    if (user !== undefined) user.grab = data.objs;
  }
  hintDrop(data) {
    const user = this.usersSet.get(data.userId);
    if (user !== undefined) user.grab = undefined;
  }
  revealObjs(data) {
    data.forEach((id) => {
      const obj = this.objs[id];
      if (obj) {
        this.emote({ type: "reveal.png", left: obj.left, top: obj.top });
      }
    });
  }
  async revealObjsDetails(data) {
    for (const el of data) {
      const obj = this.objs[el.id];
      if (obj) {
        obj.remove();
        this.objs[el.id] = new UtilityObj(
          this.layer2El,
          obj.id,
          el.data,
          obj.left,
          obj.top,
          this,
        );
        await this.objs[el.id].init();
      }
    }
  }
  emote(data) {
    // check against suspicious emotes
    const localEmote = this.serverInfo.res.emotes.find((el) => el.id == data.type.id);
    if (localEmote === undefined) {
      this.removeNotificationsByTag("invalidEmote");
      this.warn("Displayed emote seems to not exists in loaded server configuration. Someone is doing something suspicious, or configuration have been updated since you load the page!", 10000, ["invalidEmote"]);
    } else if (!arraysEq(localEmote.image, data.type.image)) {
      this.removeNotificationsByTag("invalidEmote");
      this.warn("Displayed emote seems to have different image than expected. Someone is doing something suspicious, or configuration have been updated since you load the page!", 10000, ["invalidEmote"]);
    }
    const rawUrl = Array.isArray(data.type.image) ? data.type.image[data.randomness] : data.type.image;
    const emoteUrl = this.resources.getEmoteImg?.(rawUrl) ?? rawUrl;
    this.layer3El.append(
      `<img src='${emoteUrl}' class='emote' style='left: ${data.left}px; top: ${data.top}px'>`,
    );
    const el = this.layer3El.children().last();
    el.animate({ opacity: 1 }, 200)
      .delay(800)
      .fadeOut(200, () => el.remove());
  }
  isSpectator() {
    return this.yourRole > 2;
  }
  notify(content, type, timeout = -1, tags = [], closable = true) {
    this.notificationsEl.append(`
<div class='${type} focusable' ${tags.length > 0 ? `data-tags='${tags.join(" ")}'` : ""}>
  ${closable
        ? `<div class="closeWrapper">
    <div class="closeButton" onclick="$(this).parent().parent().trigger('del')" style="z-index: 1">&times;</div>
  </div>`
        : ""
      }
</div>`);
    const addedNotificationEl = this.notificationsEl.children().last();
    if (timeout != -1) {
      addedNotificationEl.find(".closeWrapper").append(`
<svg class="progress-ring" width="20" height="20">
<circle
  class="progress-ring__circle"
  r="8" cx="10" cy="10"/>
</svg>`);
      addedNotificationEl
        .find(".progress-ring__circle")
        .animate({ strokeDashoffset: 0 }, timeout, "linear", () =>
          addedNotificationEl.trigger("del"),
        );
    }
    addedNotificationEl.on("del", (event) => {
      addedNotificationEl.stop();
      $(event.target).fadeOut({ complete: () => $(event.target).remove() });
      $(event.target).slideToggle({ queue: false });
    });
    addedNotificationEl.append(content);
    addedNotificationEl.fadeIn();
  }
  warn(content, timeout = -1, tags = [], closable = true) {
    this.notify(content, "warn", timeout, tags, closable);
  }
  info(content, timeout = -1, tags = [], closable = true) {
    this.notify(content, "info", timeout, tags, closable);
  }
  removeNotificationsByTag(tag) {
    this.notificationsEl.find(`[data-tags~="${tag}"]`).trigger("del");
  }
  removeAllNotifications() {
    this.notificationsEl.children().trigger("del");
  }
  getBoardRes(board) {
    if (this.boards[board] === undefined) {
      try {
        this.boards[board] = this.resources.getBoardInfo(board);
      } catch (err) { /* continue regardless of error */ }
    }
    return this.boards[board];
  }
  getArmyRes(army) {
    if (this.res[army] === undefined) {
      try {
        this.res[army] = this.resources.getArmyInfo(army);
      } catch (err) { /* continue regardless of error */ }
    }
    return this.res[army];
  }
  async getUnitInfo(army, unit) {
    const armyRes = await this.getArmyRes(army);
    if (armyRes === undefined) {
      this.warnInvalidRes();
      return undefined;
    }
    let unitRes = armyRes.bases.find((el) => el.name == unit);
    const isBase = unitRes !== undefined;
    unitRes = unitRes || armyRes.tokens.find((el) => el.name == unit);
    if (unitRes === undefined) {
      this.warnInvalidRes();
      return undefined;
    } else if (unitRes?.backImg !== undefined) return unitRes;
    else if (isBase)
      return Object.assign(unitRes, {
        backImg: unitRes.img,
        backImgRect: unitRes.imgRect,
      });
    else
      return Object.assign(unitRes, {
        backImg: armyRes.defBackImg,
        backImgRect: armyRes.defBackImgRect,
      });
  }
  async getMarkerInfo(army, unit) {
    const armyRes = await this.getArmyRes(army);
    if (armyRes === undefined) {
      this.warnInvalidRes();
      return undefined;
    }
    return armyRes.markers.find((el) => el.name == unit);
  }
  warnInvalidRes() {
    if (this.notificationsEl.find(`[data-tags~="invalidRes"]`).length == 0) {
      const warnNode = $(document.createElement("div"));
      warnNode.html(
        `Some resources are not valid. Click <span class='link'>here</span> to clear the table.`,
      );
      // JQUERY EVENTS HANDLERS
      warnNode
        .children("span")
        .click(this.server.requestTableClear.bind(this.server));
      warnNode
        .children("span")
        .click((event) => $(event.target).parent().parent().trigger("del"));
      this.warn(warnNode[0], INVALID_RES_TIMEOUT, ["invalidRes"]);
    }
  }
  removeEventListeners() {
    this.globalAbortController.abort();
  }
  destroy() {
    this.removeEventListeners();
    this.objs.forEach((el) => {
      if (el) el.destroy();
    });
    this.rootEl.empty();
    this.ws.terminate();
    this.destroyContextMenu?.();
  }
  async requestArmy(army, left, top) {
    const armyData = await this.getArmyRes(army.id);
    if (armyData === undefined) {
      this.warnInvalidRes();
      return;
    }
    const skipSpawner = armyData.tokens.length == 0;
    this.server.requestArmySpawner(army.id, armyData, left, top, skipSpawner);
  }
}
