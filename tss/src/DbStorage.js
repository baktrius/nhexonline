const fs = require("fs");

module.exports = class Storage {
  constructor(dbName) {
    this.file = fs.openSync(dbName, "a");
  }
  appendJson(obj) {
    fs.writeSync(this.file, JSON.stringify(obj) + '\n');
  }
  logEvent(type, data) {
    this.appendJson({ type: type, data: data });
  }
  logRequest(data) {
    this.appendJson({ type: "request", data: data });
  }
  logStat(stats) {
    this.appendJson({ type: "stat", data: stats });
  }
  addTableLabel(table, line) {
    return false;
  }
  getTableLabel(table, line) {
    return false;
  }
  getTableLabelDesc(name) {
    return false;
  }
  close() {
    fs.closeSync(this.file);
  }
};
