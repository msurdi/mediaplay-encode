const walkdir = require("walkdir");
const fs = require("fs-extra");

const fileMapToList = (fileMap) =>
  Object.keys(fileMap).map((filePath) => ({
    path: filePath,
    isDirectory: fileMap[filePath].isDirectory(),
    createdAt: fileMap[filePath].ctime,
  }));

const filesService = {
  findFiles: async (scanDir, { recurse } = {}) => {
    const fileMap = await walkdir.async(scanDir, {
      return_object: true,
      no_recurse: !recurse,
      find_links: false,
      filter: (directory, files) => (directory.startsWith(".") ? [] : files),
    });

    return fileMapToList(fileMap).filter((file) => !file.isDirectory);
    // .map((file) => file.path);
  },

  rm: async (filePath) => fs.remove(filePath),

  mv: async (sourcePath, targetPath) => fs.move(sourcePath, targetPath),

  exists: async (filePath) => fs.exists(filePath),
};

module.exports = filesService;
