const filesService = require("../services/files");
const { runFFmpeg } = require("../services/ffmpeg");
const logger = require("../services/logger");

const {
  getFailedPathFromTargetPath,
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
} = require("../utils/path");

module.exports = async (
  sourcePath,
  { encodedSuffix, preview, deleteSource, highQuality, h265 }
) => {
  const targetPath = getTargetPathFromSourcePath(sourcePath, encodedSuffix);
  const workInProgressPath = getWorkInProgressPathFromTargetPath(targetPath);
  const failedPath = getFailedPathFromTargetPath(targetPath);

  logger.info(`Encoding ${sourcePath}`);
  try {
    await runFFmpeg(sourcePath, workInProgressPath, {
      preview,
      highQuality,
      h265,
    });
    await filesService.mv(workInProgressPath, targetPath);
  } catch (error) {
    logger.error(error);
    logger.error(
      `Error encoding ${sourcePath}. Leaving failed encoding target at ${failedPath}`
    );

    if (await filesService.exists(workInProgressPath)) {
      try {
        await filesService.mv(workInProgressPath, failedPath);
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

  logger.info(`Completed encoding of ${sourcePath}`);

  if (deleteSource) {
    logger.info(`Removing ${sourcePath}`);
    await filesService.rm(sourcePath);
  }
};
