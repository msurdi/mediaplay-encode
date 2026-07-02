import fastGlob from "fast-glob";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { getLockPath, isLocked } from "./locks.ts";
import logger from "./logger.ts";
import {
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
} from "../utils/path.ts";

type CleanupStaleWorkFilesOptions = {
  scanPath: string;
  encodedSuffix: string;
  workDir: string;
  staleTimeoutMs: number;
  lockDir: string;
  lockStaleTimeoutMs: number;
};

const HASHED_WORK_DIR_NAME_PATTERN = /^[a-f0-9]{64}$/;

const isErrorWithCode = (error: unknown): error is Error & { code: string } =>
  error instanceof Error && "code" in error && typeof error.code === "string";

const expandHome = (dirPath: string): string =>
  dirPath === "~" || dirPath.startsWith("~/")
    ? path.join(os.homedir(), dirPath.slice(2))
    : dirPath;

const getMostRecentMtimeMs = async (entryPath: string): Promise<number | null> => {
  try {
    const stats = await fs.lstat(entryPath);

    if (!stats.isDirectory()) {
      return stats.mtimeMs;
    }

    const childNames = await fs.readdir(entryPath);
    let mostRecentMtimeMs = stats.mtimeMs;

    for (const childName of childNames) {
      const childMtimeMs = await getMostRecentMtimeMs(
        path.join(entryPath, childName),
      );
      if (childMtimeMs !== null) {
        mostRecentMtimeMs = Math.max(mostRecentMtimeMs, childMtimeMs);
      }
    }

    return mostRecentMtimeMs;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const removeIfStale = async (
  workPath: string,
  staleTimeoutMs: number,
  isProtected: () => Promise<boolean>,
): Promise<boolean> => {
  const mostRecentMtimeMs = await getMostRecentMtimeMs(workPath);
  if (mostRecentMtimeMs === null) {
    return false;
  }

  if (Date.now() - mostRecentMtimeMs <= staleTimeoutMs) {
    return false;
  }

  if (await isProtected()) {
    logger.debug(`Keeping stale work path with active lock: ${workPath}`);
    return false;
  }

  await fs.remove(workPath);
  logger.debug(`Removed stale work path: ${workPath}`);
  return true;
};

const getTmpFileCandidates = async (
  scanPath: string,
  encodedSuffix: string,
): Promise<string[]> => {
  const resolvedScanPath = path.resolve(expandHome(scanPath));
  const stats = await fs.stat(resolvedScanPath);

  if (stats.isFile()) {
    const targetPath = getTargetPathFromSourcePath(
      resolvedScanPath,
      encodedSuffix,
    );
    return [getWorkInProgressPathFromTargetPath(targetPath)];
  }

  const tmpPaths = await fastGlob("**/.*.tmp", {
    cwd: resolvedScanPath,
    onlyFiles: true,
    dot: true,
    absolute: true,
    followSymbolicLinks: false,
  });

  return tmpPaths
    .map(String)
    .filter((tmpPath) =>
      path.basename(tmpPath).endsWith(`${encodedSuffix}.tmp`),
    );
};

const getTargetPathFromTmpPath = (tmpPath: string): string => {
  const tmpFileName = path.basename(tmpPath);
  const targetFileName = tmpFileName.slice(1, -".tmp".length);
  return path.join(path.dirname(tmpPath), targetFileName);
};

const cleanupStaleTmpFiles = async ({
  scanPath,
  encodedSuffix,
  staleTimeoutMs,
  lockDir,
  lockStaleTimeoutMs,
}: CleanupStaleWorkFilesOptions): Promise<number> => {
  const tmpPaths = await getTmpFileCandidates(scanPath, encodedSuffix);
  let removedCount = 0;

  for (const tmpPath of tmpPaths) {
    const targetPath = getTargetPathFromTmpPath(tmpPath);
    const lockPath = getLockPath(targetPath, lockDir);
    if (
      await removeIfStale(tmpPath, staleTimeoutMs, () =>
        isLocked(lockPath, lockStaleTimeoutMs),
      )
    ) {
      removedCount++;
    }
  }

  return removedCount;
};

const cleanupStaleWorkDirEntries = async ({
  workDir,
  staleTimeoutMs,
  lockDir,
  lockStaleTimeoutMs,
}: CleanupStaleWorkFilesOptions): Promise<number> => {
  if (!workDir) {
    return 0;
  }

  const resolvedWorkDir = path.resolve(expandHome(workDir));
  const resolvedLockDir = path.resolve(expandHome(lockDir));
  let workDirEntries: string[];

  try {
    workDirEntries = await fs.readdir(resolvedWorkDir);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }

  let removedCount = 0;

  for (const entryName of workDirEntries) {
    if (!HASHED_WORK_DIR_NAME_PATTERN.test(entryName)) {
      continue;
    }

    const workPath = path.join(resolvedWorkDir, entryName);
    const lockPath = path.join(resolvedLockDir, `${entryName}.lock`);
    if (
      await removeIfStale(workPath, staleTimeoutMs, () =>
        isLocked(lockPath, lockStaleTimeoutMs),
      )
    ) {
      removedCount++;
    }
  }

  return removedCount;
};

export const cleanupStaleWorkFiles = async (
  options: CleanupStaleWorkFilesOptions,
): Promise<number> =>
  (await cleanupStaleTmpFiles(options)) +
  (await cleanupStaleWorkDirEntries(options));
