const path = require("path");

const getFailedPathForTargetPath = (targetPath) => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  return path.join(targetDir, `${targetFileName}.failed`);
};

const getTargetPathForSourcePath = (sourcePath, encodedSuffix) => {
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

module.exports = {
  getFailedPathForTargetPath,
  getTargetPathForSourcePath,
  getWorkInProgressPathFromTargetPath,
};
