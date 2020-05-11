const walkdir = require("walkdir");
const fs = require("fs-extra");
const path = require("path");

const isNotHidden = (filePath) => !filePath.startsWith(".");

const fileMapToList = (fileMap) =>
  Object.keys(fileMap).map((filePath) => ({
    path: filePath,
    isDirectory: fileMap[filePath].isDirectory(),
    modifiedAt: fileMap[filePath].mtime,
  }));

const filesService = {
  findFiles: async (scanDir, recurse = true) => {
    const fileMap = await walkdir.async(scanDir, {
      return_object: true,
      no_recurse: !recurse,
      find_links: false,
      filter: (directoryPath, fileNames) => {
        const directoryName = path.basename(directoryPath);
        const nonHiddenFiles = fileNames.filter(isNotHidden);
        return directoryName.startsWith(".") ? [] : nonHiddenFiles;
      },
    });

    return fileMapToList(fileMap).filter((file) => !file.isDirectory);
  },

  rm: async (filePath) => fs.remove(filePath),

  mv: async (sourcePath, targetPath) => fs.move(sourcePath, targetPath),

  exists: async (filePath) => fs.exists(filePath),
};

module.exports = filesService;
