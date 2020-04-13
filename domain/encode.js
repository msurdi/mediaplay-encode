const path = require("path");
const filesService = require("../services/files");
const encodeService = require("../services/encode");
const logger = require("../services/logger");
const { sleep } = require("../utils/time");

const run = async (
  scanPaths,
  {
    extensions,
    excludePattern,
    loopInterval,
    encodedSuffix,
    preview,
    deleteSource,
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

    const isEncodeable = (filePath) =>
      extensions.includes(fileExtension(filePath));

    const matchesExclusionPattern = (filePath) =>
      filePath.match(excludePattern);

    const doesNotMatchExclusionPattern = (filePath) =>
      !matchesExclusionPattern(filePath);

    const allFilesByScanPath = await Promise.all(
      scanPaths.map((scanPath) => filesService.findFiles(scanPath))
    );

    const allFiles = allFilesByScanPath.flat();
    const alreadyEncodedFiles = allFiles.filter(matchesExclusionPattern);

    const filesToEncode = allFiles
      .filter(isNotHidden)
      .filter(isEncodeable)
      .filter(doesNotMatchExclusionPattern)
      .filter(
        (f) => !alreadyEncodedFiles.includes(getTargetPathForSourcePath(f))
      )
      .filter(
        (f) =>
          !allFiles.includes(
            getWorkInProgressPathForTargetPath(getTargetPathForSourcePath(f))
          )
      )
      .filter(
        (f) =>
          !allFiles.includes(
            getFailedPathForTargetPath(getTargetPathForSourcePath(f))
          )
      );
    return filesToEncode.length ? filesToEncode[0] : null;
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
      logger.error(e);
      logger.error(
        `Error encoding ${sourcePath}. Removing failed target file ${targetPath}`
      );
      await filesService.mv(workInProgressPath, failedPath);
      throw e;
    }

    logger.info(`Encoding of ${sourcePath} completed`);

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
      await sleep(loopInterval);
    } else {
      break;
    }
  }
};

module.exports = { run };
