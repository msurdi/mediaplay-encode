const fs = require("fs-extra");
const path = require("path");
const filesService = require("../services/files");
const { runFFmpeg } = require("../services/ffmpeg");
const logger = require("../services/logger");
const size = require("../utils/size");

const {
  getFailedPathFromTargetPath,
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
} = require("../utils/path");

module.exports = async (
  sourcePath,
  { encodedSuffix, preview, deleteSource, workDir, timeoutMs = null }
) => {
  const workDirSourcePath = path.join(workDir, path.basename(sourcePath));

  if (workDir) {
    logger.info(`Copying ${sourcePath} to ${workDirSourcePath}`);
    await fs.copy(sourcePath, workDirSourcePath);
  }

  const targetPath = getTargetPathFromSourcePath(sourcePath, encodedSuffix);
  const workDirTargetPath = path.join(workDir, path.basename(targetPath));
  const workInProgressPath = getWorkInProgressPathFromTargetPath(targetPath);
  const workDirWorkInProgressPath = path.join(
    workDir,
    path.basename(workInProgressPath)
  );
  const failedPath = getFailedPathFromTargetPath(targetPath);

  const effectiveSourcePath = workDir ? workDirSourcePath : sourcePath;
  const effectiveTargetPath = workDir ? workDirTargetPath : targetPath;
  const effectiveWorkInProgressPath = workDir
    ? workDirWorkInProgressPath
    : workInProgressPath;

  const sourceSize = await size(effectiveSourcePath);
  logger.info(`Encoding ${effectiveSourcePath}`);

  if (await fs.pathExists(effectiveWorkInProgressPath)) {
    throw new Error(
      `Work in progress path already exists: ${effectiveWorkInProgressPath}`
    );
  }

  try {
    await runFFmpeg(effectiveSourcePath, effectiveWorkInProgressPath, {
      preview,
      timeoutMs,
    });

    if (await fs.pathExists(effectiveTargetPath)) {
      throw new Error(`Target path already exists: ${effectiveTargetPath}`);
    }

    await fs.move(effectiveWorkInProgressPath, effectiveTargetPath);
  } catch (error) {
    logger.error(error);
    logger.error(
      `Error encoding ${sourcePath}. Leaving failed encoding target at ${failedPath}`
    );

    if (await fs.pathExists(effectiveWorkInProgressPath)) {
      try {
        await fs.move(effectiveWorkInProgressPath, failedPath);
      } catch (moveError) {
        logger.error(
          `Could not move ${effectiveWorkInProgressPath} to ${failedPath}: ${moveError}`
        );
      }
    } else {
      /* Leave a tombstone so that no further attempts to encode this file
        are made in the future */
      await filesService.touch(failedPath);
    }

    throw error;
  }

  const targetSize = await size(effectiveTargetPath);

  logger.info(
    `Completed encoding of ${sourcePath}: ${sourceSize} -> ${targetSize}`
  );

  if (workDir) {
    logger.info(`Moving ${effectiveTargetPath} to ${workInProgressPath}`);

    // Move in two steps to keep the file hidden while copying across devices is in progress
    await fs.move(effectiveTargetPath, workInProgressPath);

    logger.info(`Moving ${workInProgressPath} to ${targetPath}`);
    await fs.move(workInProgressPath, targetPath);

    logger.info(`Removing ${workDirSourcePath}`);
    await fs.rm(workDirSourcePath);
  }

  if (deleteSource) {
    logger.info(`Removing ${sourcePath}`);
    await fs.remove(sourcePath);
  }
};
