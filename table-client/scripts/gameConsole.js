/* global $ */
const CONSOLE_HIDE_DELAY = 10000;

function onMoveConsole(event) {
  event.data.el.css(
    "left",
    parseFloat(event.data.el.css("left")) + event.originalEvent.mvX + "px",
  );
  event.data.el.css(
    "bottom",
    parseFloat(event.data.el.css("bottom")) - event.originalEvent.mvY + "px",
  );
}
function onMouseDownConsole(event) {
  if (!$(event.target).closest(event.data.el).length) event.data.blur();
}

export default class GameConsole {
  constructor(id, parent, defInputHandler) {
    this.parent = parent;
    this.id = id;
    parent.append(
      `<div id="${id}" class="console focusable" data-hidden='true' data-focused='false'>
  <div class="consoleBody">
    <div class="commandBox">
      <span class="prompt noselect">&gt;</span>
      <input type="text" class="command" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    </div>
    <div class="out"></div>
    <div style="height: 0px; flex-grow: 1"></div>
    <div class="consoleNav"></div>
  </div>
  <div class="consoleButton">...</div>
</div>`,
    );
    this.el = $(parent.children(`#${id}`));
    this.el.find(".consoleNav").mousedown(this, function (event) {
      if (event.which == 1) {
        // JQUERY EVENT HANDLERS
        $(window).mousemove(event.data, onMoveConsole);
        $(window).one("mouseup", (event) => {
          $(window).off("mousemove", onMoveConsole);
        });
      }
      event.preventDefault();
    });
    this.el.find(".command").keydown(this, function (event) {
      event.data.onKeyDown(event.which);
      event.originalEvent.cancelBubble = true;
    });
    this.hidingService = null;
    this.el.children(".consoleButton").click(() => this.get(defInputHandler));
  }
  onKeyDown(which) {
    if (which == 13) {
      const cmd = this.el.find(".command").val();
      this.onRes(cmd);
      this.el.find(".command").val("");
    } else if (which == 27) {
      this.onRes("");
      this.el.find(".command").val("");
    }
  }
  stopHidingService() {
    if (this.hidingService) {
      clearTimeout(this.hidingService);
      this.hidingService = null;
    }
  }
  startHidingService() {
    this.stopHidingService();
    this.hidingService = setInterval(
      this.finalizeHiding.bind(this),
      CONSOLE_HIDE_DELAY,
    );
  }
  finalizeHiding() {
    this.stopHidingService();
    this.el.attr("data-hidden", true);
  }
  show(hidingService = true) {
    this.el.attr("data-hidden", false);
    this.stopHidingService();
    if (hidingService && !this.isFocused()) this.startHidingService();
  }
  hide() {
    this.blur(false);
    this.finalizeHiding();
  }
  focus() {
    if (!this.isFocused()) {
      this.show(false);
      this.el.attr("data-focused", true);
      this.el.find(".command").focus();
      this.el.find(".out").scrollTop(1000000);
      $(window).mousedown(this, onMouseDownConsole);
    }
  }
  blur(hidingService = true) {
    this.el.attr("data-focused", false);
    this.el.find(".command").val("");
    this.el.find(".command").blur();
    this.el.find(".out").scrollTop(1000000);
    $(window).off("mousedown", onMouseDownConsole);
    this.stopHidingService();
    if (hidingService) this.startHidingService();
    window.getSelection().empty();
  }
  isShowed() {
    return this.el.attr("data-hidden") == "false";
  }
  isFocused() {
    return this.el.attr("data-focused") == "true";
  }
  print(text, newLine = true, color = "black") {
    const lines = text.split("\n");
    const outEl = this.el.find(".out");
    outEl.append(`<span class='${color}'></span>`);
    const desSpanEl = outEl.children().last();
    for (let i = 0; i < lines.length; ++i) {
      desSpanEl.append(document.createTextNode(lines[i]));
      if (i != lines.length - 1 || newLine) desSpanEl.append("<br>");
    }
    this.el.find(".out").scrollTop(1000000);
    this.show();
  }
  get(onRes) {
    this.onRes = onRes;
    this.focus();
  }
  clear() {
    this.el.find(".out").html("");
  }
}
