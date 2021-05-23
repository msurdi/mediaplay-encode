const { EncodingError } = require("../services/ffmpeg");
const logger = require("../services/logger");
const findNextFile = require("./find-next-file");
const { sleepSeconds } = require("../utils/time");
const processFile = require("./process-file");

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
    webm,
  }
) => {
  if (debug) {
    logger.level = "debug";
  }

  const failedFiles = [];

  const econdedExtension = webm ? "webm" : "mp4";
  const suffixWithExtension = `${encodedSuffix}.${econdedExtension}`;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    logger.debug(`Finding files to encode at ${scanPaths}`);
    const nextFile = await findNextFile({
      exclude: failedFiles,
      excludePattern,
      scanPaths,
      encodedSuffix: suffixWithExtension,
      extensions,
      reverseOrder,
    });

    if (nextFile) {
      try {
        await processFile(nextFile, {
          encodedSuffix: suffixWithExtension,
          preview,
          deleteSource,
          webm,
        });
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
