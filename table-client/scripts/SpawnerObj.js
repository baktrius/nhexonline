/* global $*/
import TokenObj from "./TokenObj.js";
import hexSvg from "./hexSvg.js";
import BoxObj from "./BoxObj.js";
import invalidRes from "./invalidRes.jpg";
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css';

export default class SpawnerObj extends BoxObj {
  constructor(parentEl, id, left, top, tokens, game) {
    super(
      parentEl,
      id,
      left,
      top,
      100,
      85,
      `<button class="spawnerButton">Next token</button>
<span class="spawnerCounter">Tokens left: <span class="value">${tokens.length}</span> &#9656;</span>`,
      game,
    );
    this.tokens = tokens;

    this.counterEl = this.objEl.find(".spawnerCounter");
    this.counterElValue = this.objEl.find(".spawnerCounter .value");
    this.buttonEl = this.objEl.find("button");
    this.buttonEl.mousedown(this.getNextToken.bind(this));
    this.tokensInfoTippy = tippy(this.counterEl[0], {
      interactive: true,
      appendTo: document.body,
      allowHTML: true,
      placement: "right",
      content: "",
      delay: [500, 0],
      theme: "light-border",
      onShow: async (instance) => {
        const counts = new Map();
        for (const token of tokens) {
          counts.set(token, (counts.get(token) || 0) + 1);
        }
        let content = "";
        for (const token of counts) {
          const [_, army, unit] = token[0].split("/");
          const info = await game.getUnitInfo(army, unit);
          const svg = info === undefined
            ? hexSvg(invalidRes)
            : hexSvg(game.resources.getTokenImg(army, info.img), info.imgRect);
          content += `<div data-res="${token[0]}" class="prev-wrap"><span class="prev-count">${token[1]}</span><span class="prev-x">&#x2715;</span>${svg}</div>`;
        }
        instance.setContent(`<div class='spawnerTokensInfo'>${content}</div>`);
        this.objEl[0].dataset.hover = "true";
      },
      onHide: () => {
        this.objEl[0].dataset.hover = "";
      },
    });
    // JQUERY EVENT HANDLERS
    $(this.tokensInfoTippy.popper).mousedown((event) => {
      const res = $(event.target).parents("div>svg").parent()[0].dataset.res;
      this.getTokenByRes(event, res);
      event.preventDefault();
    });
    if (this.tokens.length == 0) this.disableButton();
  }
  destroy() {
    this.tokensInfoTippy.destroy();
    super.destroy();
  }
  getNextToken(event) {
    if (
      event.button == 0 &&
      this.tokens.length > 0 &&
      !this.game.isSpectator()
    ) {
      this.game.server.requestNextToken(
        this.id,
        this.left,
        this.top + 80,
        this.game.yourId,
      );
      this?.tokensInfoTippy?.hide();
    }
  }
  getTokenByRes(event, res) {
    if (event.button == 0 && !this.game.isSpectator()) {
      this.game.server.requestTokenByRes(
        this.id,
        res,
        this.left,
        this.top + 80,
        this.game.yourId,
      );
      this?.tokensInfoTippy?.hide();
    }
  }
  setCounterValue(value) {
    this.counterElValue.html(value);
  }
  adjustCounterValue() {
    this.setCounterValue(this.tokens.length);
  }
  disableButton() {
    this.buttonEl.prop("disabled", true);
    this.buttonEl.blur();
    this.tokensInfoTippy.disable();
  }
  enableButton() {
    this.buttonEl.prop("disabled", false);
    this.tokensInfoTippy.enable();
  }
  async spawnToken(tokenId, newId, left, top, focus) {
    this.buttonEl.blur();
    const token = this.tokens[tokenId];
    this.tokens.splice(tokenId, 1);
    if (this.tokens.length == 0) this.disableButton();
    this.adjustCounterValue();
    const createdToken = new TokenObj(
      this.game.layer1El,
      newId,
      token,
      false,
      left,
      top,
      0,
      this.game,
      this.id,
    );
    await createdToken.init();
    this.game.objs[newId] = createdToken;
    if (focus) {
      const inGamePos = this.game.transformable.toPos({
        left: this.game.mouseX,
        top: this.game.mouseY,
      });
      createdToken.move(inGamePos.left - left, inGamePos.top - top);
      this.game.server.requestMove([
        { id: newId, left: inGamePos.left, top: inGamePos.top },
      ]);
      this.game.server.finalizeSend();
      createdToken.initMove();
    }
    this?.tokensInfoTippy?.hide();
  }
  populate(objs) {
    if (this.tokens.length == 0 && objs.length > 0) this.enableButton();
    objs.forEach((el) => {
      const token = this.game.objs[el];
      console.log(token);
      this.tokens.push(token.res);
    }, this);
    this.adjustCounterValue();
    this?.tokensInfoTippy?.hide();
  }
  depopulate(objs) {
    objs.forEach((el) => {
      this.tokens.splice(
        this.tokens.findIndex((token) => token == el.res),
        1,
      );
    });
    if (this.tokens.length == 0) this.disableButton();
    this.adjustCounterValue();
    this?.tokensInfoTippy?.hide();
  }
  remove() {
    super.remove();
    this?.tokensInfoTippy?.destroy();
  }
  setPosToVisPos() {
    super.setPosToVisPos();
    this?.tokensInfoTippy?.hide();
  }
  move(dX, dY) {
    super.move(dX, dY);
    this?.tokensInfoTippy?.hide();
  }
  setPos(left, top, duration = 200) {
    super.setPos(left, top, duration);
    this?.tokensInfoTippy?.hide();
  }
  save() {
    return Object.assign(super.save(), { tokens: this.tokens });
  }
}
