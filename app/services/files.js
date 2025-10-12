const fastGlob = require("fast-glob");
const fs = require("fs-extra");
const path = require("path");

const find = async (scanDir) => {
  const stats = await fs.stat(scanDir);

  if (stats.isFile()) {
    // If scanDir is a specific file, return just that file
    return [path.resolve(scanDir)];
  }

  // If scanDir is a directory, scan recursively
  const files = await fastGlob("**/*", {
    cwd: scanDir,
    onlyFiles: true,
    dot: false, // Exclude hidden files (starting with .)
    absolute: true,
    followSymbolicLinks: false,
  });

  return files;
};

const touch = async (filePath) => fs.writeFile(filePath, "");

const filesService = {
  find,
  touch,
};

module.exports = filesService;
