const path = require("path");
const fs = require("fs-extra");

const getFailedPathFromTargetPath = (targetPath) => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  return path.join(targetDir, `${targetFileName}.failed`);
};

const getTargetPathFromSourcePath = (sourcePath, encodedSuffix) => {
  const sourceDirectory = path.dirname(sourcePath);
  const sourceExtension = path.extname(sourcePath);
  const sourceName = path.basename(sourcePath, sourceExtension);
  const targetName = `${sourceName}${encodedSuffix}.mp4`;
  const targetPath = path.join(sourceDirectory, targetName);
  return targetPath;
};

const getWorkInProgressPathFromTargetPath = (targetPath) => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  return path.join(targetDir, `.${targetFileName}.tmp`);
};

const exists = async (filePath) => {
  try {
    await fs.access(filePath, fs.constants.F_OK);
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
  return true;
};

module.exports = {
  exists,
  getFailedPathFromTargetPath,
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
};
