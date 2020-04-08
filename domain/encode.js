const path = require("path");
const filesService = require("../services/files");
const encodeService = require("../services/encode");
const logger = require("../services/logger");
const { sleep } = require("../utils/time");

const fileExtension = (filePath) => path.extname(filePath).replace(".", "");

const findNextFile = async (scanPaths, { extensions, excludePattern }) => {
  const isEncodeable = (filePath) =>
    extensions.includes(fileExtension(filePath));

  const isNotExcluded = (filePath) => !filePath.match(excludePattern);

  const allFilesByScanPath = await Promise.all(
    scanPaths.map((scanPath) => filesService.findFiles(scanPath))
  );

  const allFiles = allFilesByScanPath.flat();

  const filesToEncode = allFiles.filter(isEncodeable).filter(isNotExcluded);

  return filesToEncode.length ? filesToEncode[0] : null;
};

const processFile = async (sourcePath, { encodedSuffix = "" } = {}) => {
  const sourceDirectory = path.dirname(sourcePath);
  const sourceExtension = path.extname(sourcePath);
  const sourceName = path.basename(sourcePath, sourceExtension);
  const targetName = `${sourceName}${encodedSuffix}.mp4`;
  const targetPath = path.join(sourceDirectory, targetName);
  await encodeService.encode(sourcePath, targetPath);
};

const run = async (
  scanPaths,
  { extensions, excludePattern, loopInterval, encodedSuffix }
) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextFile = await findNextFile(scanPaths, {
      extensions,
      excludePattern,
    });

    if (nextFile) {
      logger.info("encoding", nextFile);
      await processFile(nextFile, { encodedSuffix });
    } else if (loopInterval) {
      await sleep(loopInterval);
    } else {
      break;
    }
  }
};

module.exports = { run };
