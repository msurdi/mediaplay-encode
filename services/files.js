const walkdir = require("walkdir");
const fs = require("fs-extra");

const isNotHidden = (filePath) => !filePath.startsWith(".");

const fileMapToList = (fileMap) =>
  Object.keys(fileMap).map((filePath) => ({
    path: filePath,
    isDirectory: fileMap[filePath].isDirectory(),
  }));

const filesService = {
  findFiles: async (scanDir, { recurse } = {}) => {
    const fileMap = await walkdir.async(scanDir, {
      return_object: true,
      no_recurse: !recurse,
      find_links: false,
      filter: (directory, files) => files.filter(isNotHidden),
    });

    return fileMapToList(fileMap)
      .filter((file) => !file.isDirectory)
      .map((file) => file.path);
  },

  rm: async (filePath) => {
    await fs.remove(filePath);
  },

  mv: async (sourcePath, targetPath) => {
    await fs.move(sourcePath, targetPath);
  },
};

module.exports = filesService;
