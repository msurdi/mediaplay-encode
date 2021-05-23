const fs = require("fs-extra");
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
  { encodedSuffix, preview, deleteSource, webm }
) => {
  const targetPath = getTargetPathFromSourcePath(sourcePath, encodedSuffix);
  const workInProgressPath = getWorkInProgressPathFromTargetPath(targetPath);
  const failedPath = getFailedPathFromTargetPath(targetPath);
  const sourceSize = await size(sourcePath);

  logger.info(`Encoding ${sourcePath}`);
  try {
    await runFFmpeg(sourcePath, workInProgressPath, {
      preview,
      webm,
    });
    await fs.move(workInProgressPath, targetPath);
  } catch (error) {
    logger.error(error);
    logger.error(
      `Error encoding ${sourcePath}. Leaving failed encoding target at ${failedPath}`
    );

    if (await fs.pathExists(workInProgressPath)) {
      try {
        await fs.move(workInProgressPath, failedPath);
      } catch (moveError) {
        logger.error(
          `Could not move ${workInProgressPath} to ${failedPath}: ${moveError}`
        );
      }
    } else {
      /* Leave a tombstone so that no further attempts to encode this file
        are made in the future */
      await filesService.touch(failedPath);
    }

    throw error;
  }

  const targetSize = await size(targetPath);

  logger.info(
    `Completed encoding of ${sourcePath}: ${sourceSize} -> ${targetSize}`
  );

  if (deleteSource) {
    logger.info(`Removing ${sourcePath}`);
    await fs.remove(sourcePath);
  }
};
