/* global $ */
export default class Transformable {
  constructor(
    obj,
    minZoom,
    maxZoom,
    zoomMode = 0,
    initZoom = 1,
    initPos = { left: 0, top: 0 },
  ) {
    this.obj = $(obj);
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.setZoomMode(zoomMode);
    this.setZoom(initZoom);
    this.setPos(initPos.left, initPos.top);
    this.display();
  }
  objW() {
    return this.obj.width();
  }
  objH() {
    return this.obj.height();
  }
  parentW() {
    return this.obj.parent().width();
  }
  parentH() {
    return this.obj.parent().height();
  }
  setZoomMode(mode) {
    this.zoomMode = mode;
    this.baseZoom = mode
      ? Math.max(this.parentW() / this.objW(), this.parentH() / this.objH())
      : Math.min(this.parentW() / this.objW(), this.parentH() / this.objH());
  }
  setPos(x, y) {
    this.posX =
      Math.sign(x) *
      Math.min(
        Math.abs(x),
        Math.max(0, this.objW() * this.baseZoom * this.zoom - this.parentW()) /
          2,
      );
    this.posY =
      Math.sign(y) *
      Math.min(
        Math.abs(y),
        Math.max(0, this.objH() * this.baseZoom * this.zoom - this.parentH()) /
          2,
      );
  }
  move(deltaX, deltaY) {
    this.setPos(this.posX + deltaX, this.posY + deltaY);
    this.display();
  }
  setZoom(zoom) {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
    this.setPos(this.posX, this.posY);
  }
  scale(delta, x, y) {
    const initPos = this.toPos({ left: x, top: y });
    this.setZoom(this.zoom * delta);
    this.display();
    const endPos = this.toPos({ left: x, top: y });
    this.move(
      (endPos.left - initPos.left) * this.zoom * this.baseZoom,
      (endPos.top - initPos.top) * this.zoom * this.baseZoom,
    );
  }
  display() {
    this.obj.css(
      "transform",
      `translate(${this.parentW() / 2 - this.objW() / 2 + this.posX}px` +
        ` ,${this.parentH() / 2 - this.objH() / 2 + this.posY}px)` +
        ` scale(${this.baseZoom * this.zoom})`,
    );
  }
  toPos(pos) {
    const offset = this.obj.offset();
    return {
      left: (pos.left - offset.left) / this.zoom / this.baseZoom,
      top: (pos.top - offset.top) / this.zoom / this.baseZoom,
    };
  }
  adjust() {
    this.setZoomMode(this.zoomMode);
    this.setZoom(this.zoom);
    this.setPos(this.posX, this.posY);
    this.display();
  }
  getScale() {
    return this.baseZoom * this.zoom;
  }
}
