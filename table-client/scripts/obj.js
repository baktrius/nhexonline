/* global $ */

export default class Obj {
  constructor(parentEl, id, left, top, game, content, getHandlerEl) {
    this.parentEl = parentEl;
    this.id = id;
    this.left = left;
    this.top = top;
    this.game = game;
    this.selected = false;
    this.zIndex = 0;

    this.objEl = $(document.createElement("div"));
    this.objEl.attr("id", `obj${id}`);
    this.objEl.addClass("obj");
    this.objEl.addClass("focusable");
    this.objEl.css("left", `${this.left}px`);
    this.objEl.css("top", `${this.top}px`);
    if (content != undefined) this.objEl.append(content);
    this.parentEl.append(this.objEl);
    this.handlerEl = getHandlerEl?.(this.objEl) ?? this.objEl;

    this.handlerEl.mousedown((event) => this.handleMouseDown(event));
    this.handlerEl.mouseenter(() => {
      if (!this.game.isSpectator()) {
        this.objEl[0].dataset.hovered = "true";
      }
    });
    this.handlerEl.mouseleave(() => {
      if (!this.game.isSpectator()) {
        this.objEl[0].dataset.hovered = "false";
      }
    });

    this.objEl.keydown((event, key) => {
      if (key == "Delete") {
        game.server.requestDelete([this.id]);
        event.stopPropagation();
      }
    });
    this.objEl
      .fadeIn({ duration: 200, queue: "showQueue" })
      .dequeue("showQueue");
  }
  getVisPos() {
    return { left: this.left, top: this.top };
  }
  setPosToVisPos() {
    const visPos = this.getVisPos();
    this.left = visPos.left;
    this.top = visPos.top;
  }
  move(dX, dY) {
    this.left += dX;
    this.top += dY;
    const visPos = this.getVisPos();
    this.objEl.css("left", visPos.left + "px");
    this.objEl.css("top", visPos.top + "px");
  }
  setPos(left, top, duration = 200) {
    this.lift();
    if (top != this.top || left != this.left) {
      this.left = left;
      this.top = top;
      this.objEl
        .stop("moveQueue")
        .animate(
          { left: left, top: top },
          { duration: duration, queue: "moveQueue", easing: "linear" },
        )
        .dequeue("moveQueue");
    }
  }
  select() {
    this.selected = !this.selected;
    if (this.selected) this.game.selectedObjs.add(this);
    else this.game.selectedObjs.delete(this);
    this.objEl.attr("_selected", this.selected);
  }
  lift() {
    if (this.zIndex !== this.game.globalZIndex) {
      this.zIndex = ++this.game.globalZIndex;
      this.objEl.css("z-index", this.zIndex);
    }
  }
  remove() {
    this.objEl
      .stop("showQueue")
      .fadeOut({
        duration: 200,
        queue: "showQueue",
        complete: () => this.objEl.remove(),
      })
      .dequeue("showQueue");
  }
  handleMouseDown(event) {
    // odznaczenie obiektów w przypadku wybrania obiektu, który nie jest zaznaczony
    if (
      event.button == 2 &&
      this.game.selectedObjs.size > 0 &&
      !this.game.selectedObjs.has(this)
    ) {
      this.game.selectedObjs.forEach((el) => el.select());
    }
    // przerwanie eventu jeżeli nie jest on wywołany lewym przyciskiem myszki
    if (event.button != 0) return;
    // sprawdzenie czy gracz ma uprawnienia do przenoszenia obiektów
    if (this.game.isSpectator()) return;
    if (this.game.controlKey) {
      // obsługa zaznaczenia z naciśniętym klawiszem control
      this.lift();
      this.select();
    } else this.initMove();
  }
  initMove() {
    // obsługa przenoszenia obiektów
    // zbiór obiektów, które będą przenoszone
    // zależy on od tego czy kliknięty obiekt
    // należy do zbioru zaznaczonych obiektów
    let movedObjs;
    // przypadek gdy wybrany obiekt jest zaznaczony
    // przenoszone są wtedy wszystkie zaznaczone obiekty
    if (this.game.selectedObjs.has(this)) movedObjs = this.game.selectedObjs;
    // przypadek gdy wybrany obiekt nie jest zaznaczony
    else {
      // wszystkie zaznaczone obiekty są odznaczane
      this.game.selectedObjs.forEach((el) => el.select());
      // przenoszony jest tylko wybrany obiekt
      movedObjs = new Set().add(this);
      // wybrany obiekt jest podnoszony
      this.lift();
    }

    // zablokowanie przenoszonych obiektów
    // blokada obiektów zapobiega równoczesnemu przenoszeniu obiektów
    // przez kilku graczy
    this.game.objsLock = movedObjs;
    // wysłanie serwerowi informacji o rozpoczęciu przenoszenia obiektów
    const hintMovement = this.game.mouseUpdateCoolDown > 0;
    if (hintMovement) {
      this.game.server.hintGrab([...movedObjs].map((el) => el.id));
      this.game.sendMousePos(this.game.mouseX, this.game.mouseY);
    }
    // zaznaczenie wszystkich wybranych obiektów jako podniesione
    movedObjs.forEach((el) => {
      el.objEl[0].dataset.gripped = "true";
    });
    // callback obsługujący aktualizacje aktualnej pozycji przenoszonych obiektów
    // przy poruszaniu myszki
    const thisObj = this;
    $(window).on("mousemove.objMove", function (event) {
      const scale = thisObj.game.transformable.getScale();
      const dX = event.originalEvent.mvX / scale;
      const dY = event.originalEvent.mvY / scale;
      movedObjs.forEach((el) => el.move(dX, dY));
    });
    // callback obsługujący zakończenie przenoszenia obiektów po puszczeniu myszki
    $(window).one("mouseup", function (event) {
      // zastosowanie zmian spowodowanych przez stickyPoints do obiektów
      movedObjs.forEach((el) => {
        el.setPosToVisPos();
        el.objEl[0].dataset.gripped = "false";
      });
      // wysłanie na serwer zmian
      const changes = [...movedObjs].map((el) => ({
        id: el.id,
        left: el.left,
        top: el.top,
      }));
      thisObj.game.server.requestMove(changes);
      if (hintMovement) thisObj.game.sendDrop();
      // wyłączenie callbacku przenoszącego obiekty
      $(window).off("mousemove.objMove");
      // zwolnienie uprzednio zablokowanych obiektów
      thisObj.game.objsLock = new Set();
    });
  }
  save() {
    return {
      id: this.id,
      top: Math.round(this.top),
      left: Math.round(this.left),
    };
  }
  async init() {
    this.lift();
  }
}
