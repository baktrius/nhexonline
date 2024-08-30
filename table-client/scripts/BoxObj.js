import Obj from "./obj.js";

export default class BoxObj extends Obj {
  constructor(parentEl, id, left, top, width, height, content, game) {
    super(
      parentEl,
      id,
      left,
      top,
      game,
      `
    <div class="boxObj" style="width: ${width}px">
      <div class="boxObjHead"></div>
      <div class="boxObjBody" style="height: ${height}px">
        ${content}
      </div>
      <div class="selection"></div>
    </div>`,
      (el) => el.find(".boxObjHead"),
    );
  }
  save() {
    return Object.assign(super.save());
  }
}
