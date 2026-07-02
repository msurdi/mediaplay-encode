import { EncodingError } from "../services/ffmpeg.ts";
import {
  cleanupStaleLocks,
  LockUnavailableError,
} from "../services/locks.ts";
import logger from "../services/logger.ts";
import { cleanupStaleWorkFiles } from "../services/work-files.ts";
import findNextFile from "./find-next-file.ts";
import { sleepSeconds } from "../utils/time.ts";
import { parseTimeout } from "../utils/timeout.ts";
import processFile, { FileUnavailableError } from "./process-file.ts";

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
  lockDir: string;
  lockStaleTimeout: string;
  workStaleTimeout: string;
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
    lockDir,
    lockStaleTimeout,
    workStaleTimeout,
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

  let lockStaleTimeoutMs: number;
  try {
    lockStaleTimeoutMs = parseTimeout(lockStaleTimeout) ?? 7 * 24 * 60 * 60 * 1000;
    logger.debug(
      `Using stale lock timeout: ${lockStaleTimeout} (${lockStaleTimeoutMs}ms)`,
    );
  } catch (error) {
    logger.error(
      `Invalid lock stale timeout format: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }

  const staleLocksRemoved = await cleanupStaleLocks(
    lockDir,
    lockStaleTimeoutMs,
  );
  if (staleLocksRemoved) {
    logger.info(`Removed ${staleLocksRemoved} stale lock file(s)`);
  }

  const failedFiles: string[] = [];
  let filesEncoded = 0;

  const econdedExtension = "mp4";
  const suffixWithExtension = `${encodedSuffix}.${econdedExtension}`;

  let workStaleTimeoutMs: number;
  try {
    workStaleTimeoutMs = parseTimeout(workStaleTimeout) ?? 7 * 24 * 60 * 60 * 1000;
    logger.debug(
      `Using stale work file timeout: ${workStaleTimeout} (${workStaleTimeoutMs}ms)`,
    );
  } catch (error) {
    logger.error(
      `Invalid work stale timeout format: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }

  const staleWorkFilesRemoved = await cleanupStaleWorkFiles({
    scanPath,
    encodedSuffix: suffixWithExtension,
    workDir,
    staleTimeoutMs: workStaleTimeoutMs,
    lockDir,
    lockStaleTimeoutMs,
  });
  if (staleWorkFilesRemoved) {
    logger.info(`Removed ${staleWorkFilesRemoved} stale work file(s)`);
  }

  while (true) {
    logger.info(`Finding files to encode at ${scanPath}`);
    const nextFile = await findNextFile({
      exclude: failedFiles,
      excludePattern,
      scanPath,
      encodedSuffix: suffixWithExtension,
      extensions,
      lockDir,
      lockStaleTimeoutMs,
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
          lockDir,
          lockStaleTimeoutMs,
        });
        filesEncoded++;

        // If 'one' option is enabled, process only one file and exit
        if (one) {
          break;
        }
      } catch (error) {
        if (
          error instanceof LockUnavailableError ||
          error instanceof FileUnavailableError
        ) {
          logger.debug(error.message);
        } else if (error instanceof EncodingError) {
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
