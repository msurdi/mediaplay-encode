import { EncodingError } from "../services/ffmpeg.ts";
import logger from "../services/logger.ts";
import findNextFile from "./find-next-file.ts";
import { sleepSeconds } from "../utils/time.ts";
import { parseTimeout } from "../utils/timeout.ts";
import processFile from "./process-file.ts";

export type EncodeOptions = {
  extensions: string;
  excludePattern: string;
  loopInterval: number | string;
  encodedSuffix: string;
  preview: boolean;
  deleteSource: boolean;
  debug: boolean;
  workDir: string;
  one: boolean;
  timeout: string;
  progress: boolean;
};

export const run = async (
  scanPath: string,
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
    progress,
  }: EncodeOptions,
): Promise<number> => {
  if (debug) {
    logger.level = "debug";
  }

  // Parse timeout if provided
  let timeoutMs: number | null = null;
  if (timeout) {
    try {
      timeoutMs = parseTimeout(timeout);
      logger.debug(`Using timeout: ${timeout} (${timeoutMs}ms)`);
    } catch (error) {
      logger.error(
        `Invalid timeout format: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exit(1);
    }
  }

  const failedFiles: string[] = [];
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
          progress,
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
      await sleepSeconds(Number(loopInterval));
    } else {
      break;
    }
  }

  return filesEncoded;
};
