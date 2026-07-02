import fs from "fs-extra";
import path from "node:path";
import filesService from "../services/files.ts";
import { runFFmpeg } from "../services/ffmpeg.ts";
import {
  getLockPath,
  getTargetPathHash,
  LockUnavailableError,
  tryAcquireLock,
} from "../services/locks.ts";
import logger from "../services/logger.ts";
import size from "../utils/size.ts";

import {
  getFailedPathFromTargetPath,
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
} from "../utils/path.ts";

type ProcessFileOptions = {
  encodedSuffix: string;
  preview: boolean;
  deleteSource: boolean;
  workDir: string;
  timeoutMs?: number | null;
  progress?: boolean;
  lockDir: string;
  lockStaleTimeoutMs: number;
};

export class FileUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileUnavailableError";
  }
}

const processFile = async (
  sourcePath: string,
  {
    encodedSuffix,
    preview,
    deleteSource,
    workDir,
    timeoutMs = null,
    progress = true,
    lockDir,
    lockStaleTimeoutMs,
  }: ProcessFileOptions,
): Promise<void> => {
  const targetPath = getTargetPathFromSourcePath(sourcePath, encodedSuffix);
  const lockPath = getLockPath(targetPath, lockDir);
  const lock = await tryAcquireLock(
    lockPath,
    {
      sourcePath: path.resolve(sourcePath),
      targetPath: path.resolve(targetPath),
      staleTimeoutMs: lockStaleTimeoutMs,
    },
    lockStaleTimeoutMs,
  );

  if (!lock) {
    throw new LockUnavailableError(lockPath);
  }

  lock.startHeartbeat();

  try {
    const jobWorkDir = workDir
      ? path.join(workDir, getTargetPathHash(targetPath))
      : "";
    const workDirSourcePath = path.join(jobWorkDir, path.basename(sourcePath));
    const workDirTargetPath = path.join(jobWorkDir, path.basename(targetPath));
    const workInProgressPath = getWorkInProgressPathFromTargetPath(targetPath);
    const workDirWorkInProgressPath = path.join(
      jobWorkDir,
      path.basename(workInProgressPath),
    );
    const failedPath = getFailedPathFromTargetPath(targetPath);

    const effectiveSourcePath = workDir ? workDirSourcePath : sourcePath;
    const effectiveTargetPath = workDir ? workDirTargetPath : targetPath;
    const effectiveWorkInProgressPath = workDir
      ? workDirWorkInProgressPath
      : workInProgressPath;

    const targetPathExists = await fs.pathExists(targetPath);
    const failedPathExists = await fs.pathExists(failedPath);
    const workInProgressPathExists = await fs.pathExists(workInProgressPath);

    if (targetPathExists || failedPathExists || workInProgressPathExists) {
      throw new FileUnavailableError(
        `File became unavailable while waiting for lock: ${sourcePath}`,
      );
    }

    if (workDir) {
      await fs.ensureDir(jobWorkDir);
      logger.info(`Copying ${sourcePath} to ${workDirSourcePath}`);
      await fs.copy(sourcePath, workDirSourcePath);
    }

    const sourceSize = await size(effectiveSourcePath);
    logger.info(`Encoding ${effectiveSourcePath}`);

    if (await fs.pathExists(effectiveWorkInProgressPath)) {
      throw new Error(
        `Work in progress path already exists: ${effectiveWorkInProgressPath}`,
      );
    }

    try {
      await runFFmpeg(effectiveSourcePath, effectiveWorkInProgressPath, {
        preview,
        timeoutMs,
        progress,
      });

      if (await fs.pathExists(effectiveTargetPath)) {
        throw new Error(`Target path already exists: ${effectiveTargetPath}`);
      }

      await fs.move(effectiveWorkInProgressPath, effectiveTargetPath);
    } catch (error) {
      logger.error(error);
      logger.error(
        `Error encoding ${sourcePath}. Leaving failed encoding target at ${failedPath}`,
      );

      if (await fs.pathExists(effectiveWorkInProgressPath)) {
        try {
          await fs.move(effectiveWorkInProgressPath, failedPath);
        } catch (moveError) {
          logger.error(
            `Could not move ${effectiveWorkInProgressPath} to ${failedPath}: ${
              moveError instanceof Error ? moveError.message : String(moveError)
            }`,
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
      `Completed encoding of ${sourcePath}: ${sourceSize} -> ${targetSize}`,
    );

    if (workDir) {
      logger.info(`Moving ${effectiveTargetPath} to ${workInProgressPath}`);

      // Move in two steps to keep the file hidden while copying across devices is in progress
      await fs.move(effectiveTargetPath, workInProgressPath);

      logger.info(`Moving ${workInProgressPath} to ${targetPath}`);
      await fs.move(workInProgressPath, targetPath);

      logger.info(`Removing ${workDirSourcePath}`);
      await fs.rm(workDirSourcePath);

      await fs.remove(jobWorkDir);
    }

    if (deleteSource) {
      logger.info(`Removing ${sourcePath}`);
      await fs.remove(sourcePath);
    }
  } finally {
    await lock.release();
  }
};

export default processFile;
