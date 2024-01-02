const path = require("path");
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
  const alreadyEncodedPaths = allPaths.filter(matchesExclusionPattern);
  const isNotAlreadyEncoded = (f) =>
    !alreadyEncodedPaths.includes(
      getTargetPathFromSourcePath(f, encodedSuffix)
    );
  const isNotAlreadyInProgress = (f) =>
    !allPaths.includes(
      getWorkInProgressPathFromTargetPath(
        getTargetPathFromSourcePath(f, encodedSuffix)
      )
    );

  const isNotFailed = (f) =>
    !allPaths.includes(
      getFailedPathFromTargetPath(getTargetPathFromSourcePath(f, encodedSuffix))
    );

  const filesToEncode = allPaths
    .filter(isNotExcluded)
    .filter(isEncodeable)
    .filter(doesNotMatchExclusionPattern)
    .filter(isNotAlreadyEncoded)
    .filter(isNotAlreadyInProgress)
    .filter(isNotFailed);

  logger.debug(`All files ${allPaths.join("\n")}`);
  logger.debug(`Files to encode ${filesToEncode.join("\n")}`);

  if (filesToEncode.length === 0) {
    return null;
  }

  if (filesToEncode.length === 1) {
    return filesToEncode[0];
  }

  // Do not return the first/last elements of the array, to reduce the
  // possibility it's a file that's currently being written to.

  if (reverseOrder) {
    const secondToLast = filesToEncode[filesToEncode.length - 2];
    return secondToLast;
  }
  const second = filesToEncode[1];

  return second;
};
