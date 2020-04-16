const path = require("path");
const filesService = require("../services/files");
const { EncodingError, encodeService } = require("../services/encode");
const logger = require("../services/logger");
const { sleepSeconds } = require("../utils/time");
const {
  getFailedPathForTargetPath,
  getTargetPathForSourcePath,
  getWorkInProgressPathFromTargetPath,
} = require("../utils/path");

const run = async (
  scanPaths,
  {
    extensions,
    excludePattern,
    loopInterval,
    encodedSuffix,
    preview,
    deleteSource,
    reverseOrder,
    debug,
  }
) => {
  if (debug) {
    logger.level = "debug";
  }
  const fileExtension = (filePath) => path.extname(filePath).replace(".", "");

  const findNextFile = async (exclude = []) => {
    const isNotExcluded = (filePath) => !exclude.includes(filePath);
    const isNotHidden = (filePath) => !filePath.startsWith(".");

    const isEncodeable = (filePath) => {
      const extension = fileExtension(filePath);
      return extension && extensions.includes(extension);
    };

    const matchesExclusionPattern = (filePath) =>
      filePath.match(excludePattern);

    const doesNotMatchExclusionPattern = (filePath) =>
      !matchesExclusionPattern(filePath);

    const allFilesByScanPath = await Promise.all(
      scanPaths.map((scanPath) => filesService.findFiles(scanPath))
    );

    const filePriority = (file1, file2) => {
      return new Date(file1.createdAt) - new Date(file2.createdAt);
    };

    const allFiles = allFilesByScanPath.flat().sort(filePriority);
    const allPaths = allFiles.map((file) => file.path);
    const alreadyEncodedPaths = allPaths.filter(matchesExclusionPattern);

    logger.debug(`All files ${allPaths.join("\n")}`);
    const filesToEncode = allPaths
      .filter(isNotExcluded)
      .filter(isNotHidden)
      .filter(isEncodeable)
      .filter(doesNotMatchExclusionPattern)
      .filter(
        (f) =>
          !alreadyEncodedPaths.includes(
            getTargetPathForSourcePath(f, encodedSuffix)
          )
      )
      .filter(
        (f) =>
          !allPaths.includes(
            getWorkInProgressPathFromTargetPath(
              getTargetPathForSourcePath(f, encodedSuffix)
            )
          )
      )
      .filter(
        (f) =>
          !allPaths.includes(
            getFailedPathForTargetPath(
              getTargetPathForSourcePath(f, encodedSuffix)
            )
          )
      );
    logger.debug(`Files to encode ${filesToEncode.join("\n")}`);

    return reverseOrder ? filesToEncode.pop() : filesToEncode.shift();
  };

  const processFile = async (sourcePath) => {
    const targetPath = getTargetPathForSourcePath(sourcePath, encodedSuffix);
    const workInProgressPath = getWorkInProgressPathFromTargetPath(targetPath);
    const failedPath = getFailedPathForTargetPath(targetPath);

    logger.info(`Encoding ${sourcePath}`);
    try {
      await encodeService.encode(sourcePath, workInProgressPath, { preview });
      await filesService.mv(workInProgressPath, targetPath);
    } catch (error) {
      logger.error(error);
      logger.error(
        `Error encoding ${sourcePath}. Leaving failed encoding target at ${failedPath}`
      );

      try {
        await filesService.mv(workInProgressPath, failedPath);
      } catch (moveError) {
        logger.error(
          `Could not move ${workInProgressPath} to ${failedPath}: ${moveError}`
        );
      }

      throw error;
    }

    logger.info(`Completed encoding of ${sourcePath}`);

    if (deleteSource) {
      logger.info(`Removing ${sourcePath}`);
      await filesService.rm(sourcePath);
    }
  };

  const failedFiles = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    logger.debug(`Finding file to encode at ${scanPaths}`);
    const nextFile = await findNextFile(failedFiles);

    if (nextFile) {
      try {
        await processFile(nextFile, { encodedSuffix });
      } catch (error) {
        if (error instanceof EncodingError) {
          failedFiles.push(nextFile);
        } else {
          throw error;
        }
      }
    } else if (loopInterval) {
      logger.debug(`Sleeping for ${loopInterval} until next file search`);
      await sleepSeconds(loopInterval);
    } else {
      break;
    }
  }
};

module.exports = { run };
