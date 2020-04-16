const path = require("path");
const filesService = require("../services/files");
const encodeService = require("../services/encode");
const logger = require("../services/logger");
const { sleepSeconds } = require("../utils/time");

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
  }
) => {
  const fileExtension = (filePath) => path.extname(filePath).replace(".", "");

  const getTargetPathForSourcePath = (sourcePath) => {
    const sourceDirectory = path.dirname(sourcePath);
    const sourceExtension = path.extname(sourcePath);
    const sourceName = path.basename(sourcePath, sourceExtension);
    const targetName = `${sourceName}${encodedSuffix}.mp4`;
    const targetPath = path.join(sourceDirectory, targetName);
    return targetPath;
  };

  const getFailedPathForTargetPath = (targetPath) => {
    const targetDir = path.dirname(targetPath);
    const targetFileName = path.basename(targetPath);
    return path.join(targetDir, `${targetFileName}.failed`);
  };

  const getWorkInProgressPathForTargetPath = (targetPath) => {
    const targetDir = path.dirname(targetPath);
    const targetFileName = path.basename(targetPath);
    return path.join(targetDir, `.${targetFileName}.tmp`);
  };

  const findNextFile = async () => {
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

    const filesToEncode = allPaths
      .filter(isNotHidden)
      .filter(isEncodeable)
      .filter(doesNotMatchExclusionPattern)
      .filter(
        (f) => !alreadyEncodedPaths.includes(getTargetPathForSourcePath(f))
      )
      .filter(
        (f) =>
          !allPaths.includes(
            getWorkInProgressPathForTargetPath(getTargetPathForSourcePath(f))
          )
      )
      .filter(
        (f) =>
          !allPaths.includes(
            getFailedPathForTargetPath(getTargetPathForSourcePath(f))
          )
      );

    return reverseOrder ? filesToEncode.pop() : filesToEncode.shift();
  };

  const processFile = async (sourcePath) => {
    const targetPath = getTargetPathForSourcePath(sourcePath);
    const workInProgressPath = getWorkInProgressPathForTargetPath(targetPath);
    const failedPath = getFailedPathForTargetPath(targetPath);

    logger.info(`Encoding ${sourcePath}`);
    try {
      await encodeService.encode(sourcePath, workInProgressPath, { preview });
      await filesService.mv(workInProgressPath, targetPath);
    } catch (e) {
      logger.error(
        `Error encoding ${sourcePath}. Leaving failed encoding target at ${failedPath}`
      );
      await filesService.mv(workInProgressPath, failedPath);
      throw e;
    }

    logger.info(`Completed encoding of ${sourcePath}`);

    if (deleteSource) {
      logger.info(`Removing ${sourcePath}`);
      await filesService.rm(sourcePath);
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextFile = await findNextFile(scanPaths, {
      extensions,
      excludePattern,
    });

    if (nextFile) {
      await processFile(nextFile, { encodedSuffix });
    } else if (loopInterval) {
      await sleepSeconds(loopInterval);
    } else {
      break;
    }
  }
};

module.exports = { run };
