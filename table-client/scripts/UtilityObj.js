import Obj from "./obj.js";
import circleSvg from "./circleSvg.js";
import invalidRes from "./invalidRes.jpg";

export default class UtilityObj extends Obj {
  constructor(parentEl, id, res, left, top, game, secret = undefined) {
    super(parentEl, id, left, top, game);
    this.res = res;
    const [_, army, unit] = res.split("/");
    this.army = army;
    this.unit = unit;
    this.secret = secret;
  }
  async init() {
    await super.init();
    this.objEl.append(`<div class="token">
    <svg viewBox="-2 -2 81 81" width="77" height="77">
      <path d="M 0, 38 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" fill="#7e7e7e" style="pointer-events: fill" x="0" y="0" />
      <path class="border" d="M 0, 38 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" fill="none" stroke="#BBBBBB" stroke-width="2" x="0" y="0" />
    </svg>
    </div>`);
    this.contentEl = this.objEl.children(".token");
    this.info = await this.game.getMarkerInfo(this.army, this.unit);
    if (this.info === undefined) {
      this.contentEl.html(circleSvg(invalidRes));
    } else {
      const { img, imgRect } = this.info;

      this.contentEl.html(circleSvg(this.game.resources.getTokenImg(this.army, img), imgRect));
      this.imgFrontEl = this.objEl.find("img");
      this.imgFrontEl.mousedown((event) => event.preventDefault());
    }
  }
  save() {
    return Object.assign(super.save(), { res: this.res });
  }
}
