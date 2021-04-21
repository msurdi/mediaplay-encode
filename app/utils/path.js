const path = require("path");

const getFailedPathFromTargetPath = (targetPath) => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  return path.join(targetDir, `${targetFileName}.failed`);
};

const getTargetPathFromSourcePath = (sourcePath, encodedSuffix) => {
  const sourceDirectory = path.dirname(sourcePath);
  const sourceExtension = path.extname(sourcePath);
  const sourceName = path.basename(sourcePath, sourceExtension);
  const targetName = `${sourceName}${encodedSuffix}`;
  const targetPath = path.join(sourceDirectory, targetName);
  return targetPath;
};

const getWorkInProgressPathFromTargetPath = (targetPath) => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  return path.join(targetDir, `.${targetFileName}.tmp`);
};

module.exports = {
  getFailedPathFromTargetPath,
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
};
