const fastGlob = require("fast-glob");
const fs = require("fs-extra");
const path = require("path");

const findFirst = async (scanDir, predicate) => {
  const stats = await fs.stat(scanDir);

  if (stats.isFile()) {
    const filePath = path.resolve(scanDir);
    return (await predicate(filePath)) ? filePath : null;
  }

  const stream = fastGlob.stream("**/*", {
    cwd: scanDir,
    onlyFiles: true,
    dot: false,
    absolute: true,
    followSymbolicLinks: false,
  });

  let found = null;
  try {
    for await (const file of stream) {
      if (await predicate(file)) {
        found = file;
        // Stop the stream early
        stream.destroy();
        break;
      }
    }
  } catch (err) {
    // Ignore the expected ERR_STREAM_DESTROYED when we manually destroy
    if (err.code !== "ERR_STREAM_DESTROYED") throw err;
  }

  return found;
};

const touch = async (filePath) => fs.writeFile(filePath, "");

const filesService = {
  findFirst,
  touch,
};

module.exports = filesService;
