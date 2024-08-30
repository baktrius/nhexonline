/* global $ */

export default class {
  constructor(parentEl, onUpdate) {
    this.parentEl = parentEl;
    this.onUpdate = onUpdate;
    this.left = 0;
    this.top = 0;
  }
  disable() {
    this.parentEl.children(".selectBox").remove();
    $(window).off("mousemove.select");
  }
  enable(mouseX, mouseY) {
    this.left = mouseX;
    this.top = mouseY;

    const { left: pLeft, top: pTop } = this.parentEl.offset();
    this.parentEl.append(
      `<div class='selectBox' style='left: ${mouseX - pLeft}px; top: ${mouseY - pTop}px; width: 0px; height: 0px'></div>`,
    );
    const el = this.parentEl.children(".selectBox");
    const thisObj = this;
    $(window).on("mousemove.select", function (event) {
      const left = Math.min(event.pageX, thisObj.left);
      const top = Math.min(event.pageY, thisObj.top);
      const width = Math.abs(event.pageX - thisObj.left);
      const height = Math.abs(event.pageY - thisObj.top);
      el.css("left", left - pLeft + "px");
      el.css("top", top - pTop + "px");
      el.css("width", width + "px");
      el.css("height", height + "px");
      thisObj.onUpdate(left, top, width, height);
    });
    $(window).one("mouseup", function (event) {
      if (event.button == 0) thisObj.disable();
    });
  }
}
