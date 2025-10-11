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
  scanPath,
  encodedSuffix,
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

  const allFiles = await filesService.find(scanPath);
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

  return candidateFilesToEncode[0];
};
