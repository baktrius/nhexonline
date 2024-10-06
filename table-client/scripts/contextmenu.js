/* global $ */
import openInNewTab from "./openInNewTab.js";
import toggleFullScreen from "./toggleFullScreen.js";

function objMenuCallback(key, options, pos, game) {
  if (game.selectedObjs.size > 0) {
    if (key == "flip") {
      game.server.requestFlip(
        [...game.selectedObjs]
          .filter((el) => el.flipped !== undefined)
          .map((el) => el.id),
      );
    } else if (key == "delete")
      game.server.requestDelete([...game.selectedObjs].map((el) => el.id));
    else if (key == "rotateLeft") {
      game.server.requestLeftRotate(
        [...game.selectedObjs]
          .filter((el) => el.angle !== undefined)
          .map((el) => el.id),
      );
    } else if (key == "rotateRight") {
      game.server.requestRightRotate(
        [...game.selectedObjs]
          .filter((el) => el.angle !== undefined)
          .map((el) => el.id),
      );
    } else if (key == "reveal") {
      game.server.requestReveal(
        [...game.selectedObjs]
          .filter((el) => el.secret !== undefined)
          .map((el) => el.id),
      );
    } else if (key == "return") {
      game.server.requestReturn(
        [...game.selectedObjs]
          .filter((el) => el.spawnerId !== undefined)
          .map((el) => el.id),
      );
    }
  } else {
    const id = parseInt(options.$trigger.attr("id").slice(3));
    if (key == "flip") game.server.requestFlip([id]);
    else if (key == "delete") game.server.requestDelete([id]);
    else if (key == "rotateLeft") game.server.requestLeftRotate([id]);
    else if (key == "rotateRight") game.server.requestRightRotate([id]);
    else if (key == "return") game.server.requestReturn([id]);
    else if (key == "reveal") game.server.requestReveal([id]);
  }
}

function globalMenuCallback(key, options, menuPos, game) {
  if (key == "clearTable") game.server.requestTableClear();
  else if (key == "clearConsole") game.gameConsole.clear();
  else if (key == "zoomIn")
    game.transformable.scale(1.25, menuPos.left, menuPos.top);
  else if (key == "zoomOut")
    game.transformable.scale(0.8, menuPos.left, menuPos.top);
  else if (key == "fullScreen") toggleFullScreen();
  else if (key == "saveGame") game.save();
  else if (key == "loadGame") game.open();
  else if (key == "undo") game.server.requestUndo();
  else if (key == "redo") game.server.requestRedo();
  else {
    const pos = game.transformable.toPos(menuPos);
    const tokens = key.split("-");
    if (tokens[0] == "getRandomArmy")
      game.server.requestArmySpawner(game.randomArmy(), pos.left, pos.top, game);
    else if (tokens[0] == "open") {
      openInNewTab(game.serverInfo.res.links[parseInt(tokens[1])].url);
    }
  }
}

const MAX_ELEMS_IN_SUBMENU = 12;

function optimizeContextMenu(config) {

  if (config.items === undefined) return config;
  // optimize submenus recursively
  let entries = Object.entries(config.items);
  entries = entries.map(([k, v], i) => [k, optimizeContextMenu(v)])
  // Remove empty submenus
  entries = entries.filter((el) => el?.items?.length !== 0)
  // Split long submenus
  entries = entries.map(([key, el]) => {
    const entries = Object.entries(el?.items ?? {});
    if (entries.length <= MAX_ELEMS_IN_SUBMENU) return [[key, el]];
    const res = [];
    for (let i = 0; i < entries.length; i += MAX_ELEMS_IN_SUBMENU) {
      const j = Math.min(i + MAX_ELEMS_IN_SUBMENU, entries.length);
      const nameSufix = i + 1 == j ? `${i + 1}` : `${i + 1}-${j}`
      res.push([
        `${key}-${i}`,
        {
          name: `${el.name} [${nameSufix}]`,
          items: Object.fromEntries(entries.slice(i, j)),
        }]);
    }
    return res;
  }).flat();
  // Fold one element submenus
  entries = entries.map(([key, el]) => {
    const entries = Object.entries(el?.items ?? {});
    if (entries.length !== 1) return [key, el];
    const [itemKey, item] = entries[0];
    return [
      itemKey,
      Object.assign({}, item, { name: `${el.name} / ${item.name}` }),
    ]
  })
  return Object.assign({}, config, { items: Object.fromEntries(entries) });
}

function partition(arr, fn) {
  return arr.reduce(
    (acc, val, i, arr) => {
      acc[fn(val, i, arr) ? 0 : 1].push(val);
      return acc;
    },
    [[], []]
  );
}

let contextMenuX = 0;
let contextMenuY = 0;
export default async function initContextMenu(game, armies, rootEl) {
  const rotateDisFunc = function (key, opt) {
    return (
      game.isSpectator() ||
      // eslint-disable-next-line no-invalid-this
      (game.selectedObjs.size == 0 &&
        game.objs[this.attr("id").slice(3)].angle === undefined)
    );
  };
  const flipDisFunc = function (key, opt) {
    return (
      game.isSpectator() ||
      // eslint-disable-next-line no-invalid-this
      (game.selectedObjs.size == 0 &&
        game.objs[this.attr("id").slice(3)].flipped === undefined)
    );
  };
  const returnFunc = function (key, opt) {
    return (
      game.isSpectator() ||
      // eslint-disable-next-line no-invalid-this
      (game.selectedObjs.size == 0 &&
        game.objs[this.attr("id").slice(3)].spawnerId === undefined)
    );
  };
  const revealFunc = function (key, opt) {
    return (
      game.isSpectator() ||
      // eslint-disable-next-line no-invalid-this
      (game.selectedObjs.size == 0 &&
        game.objs[this.attr("id").slice(3)].secret === undefined)
    );
  };
  $.contextMenu({
    selector: ".obj",
    callback: (key, options) =>
      objMenuCallback(
        key,
        options,
        { left: contextMenuX, top: contextMenuY },
        game,
      ),
    items: {
      rotateLeft: { name: "Rotate left (Left Arrow)", disabled: rotateDisFunc },
      rotateRight: {
        name: "Rotate right (Right Arrow)",
        disabled: rotateDisFunc,
      },
      flip: { name: "Flip (Up Arrow)", disabled: flipDisFunc },
      delete: { name: "Delete (Del)", disabled: () => game.isSpectator() },
      return: { name: "Return to spawner", disabled: returnFunc },
      reveal: { name: "Reveal", disabled: revealFunc },
    },
  });

  function getPos() {
    return game.transformable.toPos({ left: contextMenuX, top: contextMenuY })
  }

  function genArmiesEntries(armies) {
    return Object.fromEntries(armies.map((army) => ["getArmy-" + army.id, {
      name: army.name,
      callback: () => {
        const pos = getPos();
        game.server.requestArmySpawner(army.id, pos.left, pos.top, game);
      }
    }]))
  }

  function subArmiesMenu(armies, key, name) {
    if (armies.length === 0) return {};
    return {
      key: {
        name: name,
        items: genArmiesEntries(armies),
      }
    }
  }

  const [utilityArmies, commonArmies] = partition(armies, (army) => army.utility);
  const [privateArmies, publicArmies] = partition(commonArmies, (army) => army.private);
  const [customArmies, officialArmies] = partition(publicArmies, (army) => army.custom);
  const armiesMenu = Object.assign(
    armies.length > 0 ? { getRandomArmy: { name: "Random" } } : {},
    subArmiesMenu(customArmies, "getCustomArmy", "Custom"),
    subArmiesMenu(privateArmies, "getPrivateArmy", "Private"),
    genArmiesEntries(officialArmies),
  );

  async function genUtilityEntry(armyInfo) {
    function getUnitMapper(marker) {
      return function (unit) {
        return [`getUtility-${armyInfo.id}-${unit.id}`, {
          name: unit.name,
          callback: (itemKey, opt) => {
            const pos = getPos();
            const obj = {
              left: pos.left,
              top: pos.top,
              res: `armies/${armyInfo.id}/${unit.name}`,
            };
            if (!marker) Object.assign(obj, { flipped: false, angle: 0 });
            game.server.requestUtility(obj);
          },
        }]
      }
    }
    const tokenMapper = getUnitMapper(false);
    const markerMapper = getUnitMapper(true);
    const army = await game.getArmyRes(armyInfo.id);
    return ["getUtility-" + army.id, {
      name: army.name,
      items: Object.fromEntries([
        ...army.tokens.map(tokenMapper),
        ...army.bases.map(tokenMapper),
        ...army.markers.map(markerMapper)]),
    }]
  }

  const items = {
    getArmy: {
      name: "Get army",
      items: armiesMenu,
      disabled: () => game.isSpectator(),
    },
    getUtility: {
      name: "Get utility",
      items: Object.fromEntries(await Promise.all(utilityArmies.map(genUtilityEntry))),
      disabled: () => game.isSpectator(),
    },
    getEmoji: {
      name: "Get emote",
      items: (() => {
        const res = {};
        game.serverInfo.res.emotes.forEach((emote) => {
          res["getEmote-" + emote.id] = {
            name: `${emote.name} (${emote.keyshortcut})`, callback: () => {
              const pos = getPos();
              game.server.requestEmote(emote, pos.left, pos.top);
            }
          };
        });
        return res;
      })(),
      disabled: () => game.isSpectator(),
    },
    sep2: "---------",
    fullScreen: { name: "Fullscreen mode" },
    sep3: "---------",
    clearTable: { name: "Clear table", disabled: () => game.isSpectator() },
    saveGame: { name: "Save table" },
    loadGame: { name: "Load table", disabled: () => game.isSpectator() },
    sep4: "---------",
    undo: { name: "Undo (KeyZ)", disabled: () => game.isSpectator() },
    redo: { name: "Redo (KeyY)", disabled: () => game.isSpectator() },
  }
  const links = game.serverInfo.res.links;
  if (links.length > 0) {
    items.sep5 = "---------";
    items.openInstruction = {
      name: "Open instruction",
      items: Object.fromEntries(links.map((link, index) => ["open-" + index, { name: link.name }])),
    };
  }
  // TODO remove global selector
  const config = optimizeContextMenu({
    selector: "#table",
    callback: (key, options) =>
      globalMenuCallback(
        key,
        options,
        { left: contextMenuX, top: contextMenuY },
        game,
      ),
    items,
  });
  $.contextMenu(config);

  // JQUERY EVENT HANDLERS
  rootEl.mousedown(function (event) {
    if (event.button == 2) {
      contextMenuX = event.originalEvent.pageX;
      contextMenuY = event.originalEvent.pageY;
    }
  });

  return () => {
    $.contextMenu("destroy", "#table");
    $.contextMenu("destroy", ".obj");
  }
}
