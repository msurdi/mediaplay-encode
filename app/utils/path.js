const path = require("path");

const getFailedPathFromTargetPath = (targetPath) => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  const shortenedTargetFileName = targetFileName.slice(0, 240);
  return path.join(targetDir, `${shortenedTargetFileName}.failed`);
};

const getTargetPathFromSourcePath = (sourcePath, encodedSuffix) => {
  const sourceDirectory = path.dirname(sourcePath);
  const sourceExtension = path.extname(sourcePath);
  const sourceName = path.basename(sourcePath, sourceExtension);
  const targetName = `${sourceName}${encodedSuffix}`;
  const shortenedTargetName = targetName.slice(0, 240);
  const targetPath = path.join(sourceDirectory, shortenedTargetName);
  return targetPath;
};

const getWorkInProgressPathFromTargetPath = (targetPath) => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  const shortenedTargetFileName = targetFileName.slice(0, 240);
  return path.join(targetDir, `.${shortenedTargetFileName}.tmp`);
};

module.exports = {
  getFailedPathFromTargetPath,
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
};
