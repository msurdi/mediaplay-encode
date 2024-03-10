const path = require("path");
const fs = require("fs-extra");
const filesService = require("../services/files");
const logger = require("../services/logger");

const fileExtension = (filePath) => path.extname(filePath).replace(".", "");

const {
  getFailedPathFromTargetPath,
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
} = require("../utils/path");

module.exports = async ({
  exclude = [],
  excludePattern,
  extensions,
  scanPaths,
  encodedSuffix,
  reverseOrder,
}) => {
  const isNotExcluded = (filePath) => !exclude.includes(filePath);

  const caseInsensitiveExtensions = extensions
    .split(",")
    .map((extension) => extension.toLowerCase());

  const isEncodeable = (filePath) => {
    const extension = fileExtension(filePath).toLowerCase();
    return extension && caseInsensitiveExtensions.includes(extension);
  };

  const matchesExclusionPattern = (filePath) => filePath.match(excludePattern);

  const doesNotMatchExclusionPattern = (filePath) =>
    !matchesExclusionPattern(filePath);

  const allFilesByScanPath = await Promise.all(
    scanPaths.map((scanPath) => filesService.find(scanPath))
  );

  const filePriority = (file1, file2) =>
    new Date(file1.modifiedAt) - new Date(file2.modifiedAt);

  const allFiles = allFilesByScanPath.flat().sort(filePriority);
  const allPaths = allFiles.map((file) => file.path);

  const filesToEncode = allPaths
    .filter(isNotExcluded)
    .filter(isEncodeable)
    .filter(doesNotMatchExclusionPattern);

  const candidateFilesToEncode = [];
  for (const fileToEncode of filesToEncode) {
    const targetPath = getTargetPathFromSourcePath(fileToEncode, encodedSuffix);
    const failedPath = getFailedPathFromTargetPath(targetPath);
    const inProgressPath = getWorkInProgressPathFromTargetPath(targetPath);

    const targetPathExists = await fs.exists(targetPath);
    const failedPathExists = await fs.exists(failedPath);
    const inProgressPathExists = await fs.exists(inProgressPath);

    if (
      ![targetPathExists, failedPathExists, inProgressPathExists].some(Boolean)
    ) {
      candidateFilesToEncode.push(fileToEncode);
    }
  }

  logger.debug(`All files ${allPaths.join("\n")}`);
  logger.debug(`Files to encode ${filesToEncode.join("\n")}`);

  if (candidateFilesToEncode.length === 0) {
    return null;
  }

  if (candidateFilesToEncode.length === 1) {
    return candidateFilesToEncode[0];
  }

  // Do not return the first/last elements of the array, to reduce the
  // possibility it's a file that's currently being written to.

  if (reverseOrder) {
    const secondToLast =
      candidateFilesToEncode[candidateFilesToEncode.length - 2];
    return secondToLast;
  }
  const second = candidateFilesToEncode[1];

  return second;
};
