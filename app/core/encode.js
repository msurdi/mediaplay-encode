const { EncodingError } = require("../services/ffmpeg");
const logger = require("../services/logger");
const findNextFile = require("./find-next-file");
const { sleepSeconds } = require("../utils/time");
const { parseTimeout } = require("../utils/timeout");
const processFile = require("./process-file");

const run = async (
  scanPath,
  {
    extensions,
    excludePattern,
    loopInterval,
    encodedSuffix,
    preview,
    deleteSource,
    debug,
    workDir,
    one,
    timeout,
  }
) => {
  if (debug) {
    logger.level = "debug";
  }

  // Parse timeout if provided
  let timeoutMs = null;
  if (timeout) {
    try {
      timeoutMs = parseTimeout(timeout);
      logger.debug(`Using timeout: ${timeout} (${timeoutMs}ms)`);
    } catch (error) {
      logger.error(`Invalid timeout format: ${error.message}`);
      process.exit(1);
    }
  }

  const failedFiles = [];
  let filesEncoded = 0;

  const econdedExtension = "mp4";
  const suffixWithExtension = `${encodedSuffix}.${econdedExtension}`;

  while (true) {
    logger.info(`Finding files to encode at ${scanPath}`);
    const nextFile = await findNextFile({
      exclude: failedFiles,
      excludePattern,
      scanPath,
      encodedSuffix: suffixWithExtension,
      extensions,
    });

    if (nextFile) {
      try {
        await processFile(nextFile, {
          encodedSuffix: suffixWithExtension,
          preview,
          deleteSource,
          workDir,
          timeoutMs,
        });
        filesEncoded++;

        // If 'one' option is enabled, process only one file and exit
        if (one) {
          break;
        }
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

  return filesEncoded;
};

module.exports = { run };
