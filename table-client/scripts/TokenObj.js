/* global */
import tippy, { followCursor } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css';
import Obj from "./obj.js";
import hexSvg from "./hexSvg.js";
import generateInfo from "./generateInfo.js";
import invalidRes from "./invalidRes.jpg";

function applySticky(points, left, top) {
  const res = points.find(
    (el) =>
      (el.left - left) * (el.left - left) + (el.top - top) * (el.top - top) <
      2000,
  );
  return res !== undefined ? res : { left: left, top: top };
}
export default class TokenObj extends Obj {
  constructor(parentEl, id, res, flipped, left, top, angle, game, spawnerId) {
    super(parentEl, id, left, top, game);
    this.angle = angle;
    this.flipped = flipped;
    this.res = res;
    const [_, army, unit] = res.split("/");
    this.army = army;
    this.unit = unit;
    this.spawnerId = spawnerId;
  }
  async init() {
    await super.init();
    const game = this.game;
    this.relativeRotate = await this.game.getRelativeRotate();
    this.objEl.append(
      `<div class='rotator' style='transform: rotate(${this.angle + this.relativeRotate}deg)'>
  <div class='flip-card'>
    <div class="flip-card-inner">
      <div class="flip-card-front">
        <svg viewBox="-2 -2 197 172">
          <path d="M 48,1 L 0,85 48,167 144,167 192,85 144,1 48,1 Z" fill="#7e7e7e" style="pointer-events: fill" />
          <path class="border" d="M 48,1 L 0,85 48,167 144,167 192,85 144,1 48,1 Z" fill="none" stroke="#BBBBBB" stroke-width="2" />
        </svg>
      </div>
      <div class="flip-card-back">
        <svg viewBox="-2 -2 197 172">
        <path d="M 48,1 L 0,85 48,167 144,167 192,85 144,1 48,1 Z" fill="#7e7e7e" style="pointer-events: fill" />
        <path class="border" d="M 48,1 L 0,85 48,167 144,167 192,85 144,1 48,1 Z" fill="none" stroke="#BBBBBB" stroke-width="2" />
      </svg>
      </div>
    </div>
  </div>
</div>`,
    );
    this.objEl.attr("flipped", this.flipped ? "true" : "false");
    this.content = this.objEl.find(".flip-card-inner");
    this.rotator = this.objEl.find(".rotator");
    this.imgFrontContainerEl = this.objEl.find(".flip-card-front");
    this.imgBackContainerEl = this.objEl.find(".flip-card-back");
    this.stickyPoints = await this.game.getStickyPoints();
    this.info = await game.getUnitInfo(this.army, this.unit);
    if (this.info === undefined) {
      this.imgFrontContainerEl.html(hexSvg(invalidRes));
      this.imgBackContainerEl.html(hexSvg(invalidRes));
    } else {
      const { img, backImg, imgRect, backImgRect } = this.info;
      this.imgFrontContainerEl.html(hexSvg(this.game.resources.getTokenImg(this.army, img), imgRect));
      this.imgBackContainerEl.html(hexSvg(this.game.resources.getTokenImg(this.army, backImg), backImgRect));
    }

    this.objEl.keydown((event, key) => {
      if (key == "KeyA" || key == "ArrowLeft") {
        game.server.requestLeftRotate([this.id]);
        event.stopPropagation();
      } else if (key == "KeyD" || key == "ArrowRight") {
        game.server.requestRightRotate([this.id]);
        event.stopPropagation();
      } else if (
        key == "KeyW" ||
        key == "KeyS" ||
        key == "ArrowUp" ||
        key == "ArrowDown"
      ) {
        game.server.requestFlip([this.id]);
        event.stopPropagation();
      }
    });
    if (this.info) {
      this.tokensInfoTippy = tippy(this.objEl[0], {
        allowHTML: true,
        maxWidth: 300,
        content: `
  ${this.info.info === undefined || this.info.info === ""
            ? `<b>${this.info.name}</b>`
            : `<span class="more"><b>${this.info.name}</b> (...)</span><div class="help">${generateInfo(
              await game.getArmyRes(this.army),
              this.info.info,
              this.unit,
            )}</div>`
          }`,
        delay: [1000, 0],
        theme: "light-border not-disturbing",
        interactive: true,
        appendTo: document.body,
        arrow: false,
        followCursor: "initial",
        plugins: [followCursor],
        placement: "right",
      });
    }
  }
  getVisPos() {
    return applySticky(this.stickyPoints, this.left, this.top);
  }
  setAngle(angle) {
    if (this.angle != angle) {
      this.angle = angle;
      this.lift();
      this.rotator.css(
        "transform",
        `rotate(${this.angle + this.relativeRotate}deg)`,
      );
    }
  }
  setFlip(state) {
    if (this.flipped != state) {
      this.lift();
      this.flipped = state;
      this.objEl.attr("flipped", this.flipped);
    }
  }
  save() {
    return Object.assign(super.save(), {
      angle: this.angle,
      flipped: this.flipped,
      res: this.res,
    });
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
}
