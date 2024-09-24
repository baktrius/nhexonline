const { promisify } = require("util");
const fs = require("fs");

const TABLE_DUMP_TIMEOUT = 10000;

module.exports = class FileTableStorage {
  constructor(dumpFilePath) {
    this.dumpFilePath = dumpFilePath;
    this.dumpBuffer = "";
    this.dumpService = undefined;
  }
  async load() {
    // check if dump file exists
    if (!(await promisify(fs.exists)(this.dumpFilePath))) {
      throw new Error(`error file ${this.dumpFilePath} does not exist`);
    }
    this.dumpFileLines = 1;
    let loadingError;
    return await this.loadFromDumpFile(this.dumpFilePath);
  }
  async loadFromDumpFile(path, line = -1, lockedFiles = new Set(), tableEntries = []) {
    if (lockedFiles.has(path)) {
      throw new Error(`error file ${path}, has been already referenced`);
    }
    lockedFiles.add(path);
    let success = true;
    const content = await promisify(fs.readFile)(path, "utf8");
    const entires = content.split("\n");
    if (line === -1 && lockedFiles.size === 1) {
      this.dumpFileLines = entires.length;
      this.lastLineNotEmpty = entires[entires.length - 1] !== "";
      line = entires.length - 1;
    }
    while (line !== -1) {
      if (typeof line !== "number") {
        throw new Error("line number not numeric");
      }
      if (entires[line] == "") {
        --line;
        continue;
      }
      try {
        const entry = JSON.parse(entires[line]);
        if (entry.act !== undefined) {
          tableEntries.push({
            act: entry.act,
            place: { line: line, file: path },
          });
        }
        const prevLine = entry?.prev?.line;
        const prevFile = entry?.prev?.file;
        if (prevFile !== undefined && prevFile !== path) {
          return await this.loadFromDumpFile(prevFile, prevLine, lockedFiles, tableEntries);
        }
        if (prevLine !== undefined) {
          if (prevLine >= line) {
            throw new Error("invalid prev line value");
          }
          line = prevLine;
        } else --line;
      } catch (err) {
        console.log(
          `error (${err}) in line no ${line} in file ${path}, starting again from line ${line - 1}`,
        );
        success = false;
        --line;
        tableEntries.length = 0;
      }
    }
    return tableEntries;
  }
  initDumping(onError) {
    this.outStream = fs.createWriteStream(this.dumpFilePath, { flags: "a" });
    this.outStream?.on?.("error", (err) => {
      this.outStream = undefined;
      onError(err);
    });
    if (this.lastLineNotEmpty === true) {
      this.outStream.write("\n");
      ++this.dumpFileLines;
    }
  }
  dump(place, important = false, action = undefined) {
    const cmd = { prev: this.simplifyPlace(place) };
    if (action !== undefined) {
      cmd.act = action;
    }
    if (this.outStream !== undefined) {
      this.dumpBuffer += JSON.stringify(cmd) + '\n';
      if (important) {
        this.writeDumpBufferToFile();
      } else if (this.dumpService === undefined) {
        console.log("initialize saving");
        this.dumpService = setTimeout(
          this.writeDumpBufferToFile.bind(this),
          TABLE_DUMP_TIMEOUT,
        );
      }
      ++this.dumpFileLines;
    }
  }
  writeDumpBufferToFile() {
    if (this.dumpService !== undefined) {
      clearTimeout(this.dumpService);
      this.dumpService = undefined;
    }
    if (this.dumpBuffer !== "" && this.outStream !== undefined) {
      console.log("saving table state");
      this.outStream?.write?.(this.dumpBuffer);
      this.dumpBuffer = "";
    }
  }
  close() {
    if (this.outStream !== undefined) {
      if (this.dumpBuffer.length > 0) {
        this.writeDumpBufferToFile();
      }
      // setTimeout(() => {
      this.outStream.close();
      this.outStream = undefined;
      // }, 1000);
    }
  }
  simplifyPlace(place) {
    if (place.file === undefined || place.file === this.dumpFilePath) {
      if (place.line === undefined || place.line === this.dumpFileLines - 2)
        return undefined;
      else return { line: place.line };
    } else return place;
  }
  getCurrentPlace() {
    return { line: this.dumpFileLines - 1 };
  }
  async init(boardName) {
    const file = await fs.promises.open(this.dumpFilePath, "wx");
    if (boardName !== undefined) {
      await file.write(JSON.stringify({ act: { board: boardName } }) + '\n');
    }
    await file.close();
  }
};
