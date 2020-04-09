const path = require("path");
const filesService = require("../services/files");
const encodeService = require("../services/encode");
const logger = require("../services/logger");
const { sleep } = require("../utils/time");

const run = async (
  scanPaths,
  { extensions, excludePattern, loopInterval, encodedSuffix }
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

  const findNextFile = async () => {
    const isEncodeable = (filePath) =>
      extensions.includes(fileExtension(filePath));

    const isNotExcluded = (filePath) => !filePath.match(excludePattern);

    const isNotAlreadyEncoded = (filePath) =>
      !filesService.exists(getTargetPathForSourcePath(filePath));

    const allFilesByScanPath = await Promise.all(
      scanPaths.map((scanPath) => filesService.findFiles(scanPath))
    );

    const allFiles = allFilesByScanPath.flat();

    const filesToEncode = allFiles
      .filter(isEncodeable)
      .filter(isNotExcluded)
      .filter(isNotAlreadyEncoded);

    return filesToEncode.length ? filesToEncode[0] : null;
  };

  const processFile = async (sourcePath) => {
    const targetPath = getTargetPathForSourcePath(sourcePath);
    await encodeService.encode(sourcePath, targetPath);
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextFile = await findNextFile(scanPaths, {
      extensions,
      excludePattern,
    });

    if (nextFile) {
      logger.info(`Encoding ${nextFile}`);
      await processFile(nextFile, { encodedSuffix });
      logger.info(`Encoding of ${nextFile} completed`);
    } else if (loopInterval) {
      await sleep(loopInterval);
    } else {
      logger.info("No more files to encode");
      break;
    }
  }
};

module.exports = { run };
