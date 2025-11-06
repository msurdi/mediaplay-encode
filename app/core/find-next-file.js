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

  // Combined predicate that checks if a file should be encoded
  const shouldEncode = async (filePath) => {
    // First apply the quick filters
    if (!isNotExcluded(filePath)) return false;
    if (!isEncodeable(filePath)) return false;
    if (!doesNotMatchExclusionPattern(filePath)) return false;

    // Then check if the file can actually be processed (no target/failed/in-progress files exist)
    const targetPath = getTargetPathFromSourcePath(filePath, encodedSuffix);
    const failedPath = getFailedPathFromTargetPath(targetPath);
    const inProgressPath = getWorkInProgressPathFromTargetPath(targetPath);

    const targetPathExists = await fs.exists(targetPath);
    const failedPathExists = await fs.exists(failedPath);
    const inProgressPathExists = await fs.exists(inProgressPath);

    return ![targetPathExists, failedPathExists, inProgressPathExists].some(
      Boolean
    );
  };

  logger.debug(`Searching for next file to encode in: ${scanPath}`);

  // Use the new findFirst method to stop as soon as we find a matching file
  const nextFile = await filesService.findFirst(scanPath, shouldEncode);

  if (nextFile) {
    logger.debug(`Found next file to encode: ${nextFile}`);
  } else {
    logger.debug("No files found to encode");
  }

  return nextFile;
};
