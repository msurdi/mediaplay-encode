import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
} from "node:fs/promises";
import logger from "./logger.ts";

export type LockMetadata = {
  sourcePath: string;
  targetPath: string;
  staleTimeoutMs: number;
};

type StoredLockMetadata = LockMetadata & {
  lockId: string;
  pid: number;
  hostname: string;
  createdAt: string;
  lastHeartbeatAt: string;
};

export type LockHandle = {
  lockPath: string;
  metadata: StoredLockMetadata;
  startHeartbeat: () => void;
  release: () => Promise<void>;
};

const MAX_HEARTBEAT_INTERVAL_MS = 30_000;
const MIN_HEARTBEAT_INTERVAL_MS = 100;

export class LockUnavailableError extends Error {
  constructor(lockPath: string) {
    super(`Lock already exists: ${lockPath}`);
    this.name = "LockUnavailableError";
  }
}

const isErrorWithCode = (error: unknown): error is Error & { code: string } =>
  error instanceof Error && "code" in error && typeof error.code === "string";

const expandHome = (dirPath: string): string =>
  dirPath === "~" || dirPath.startsWith("~/")
    ? path.join(os.homedir(), dirPath.slice(2))
    : dirPath;

export const getDefaultLockDir = (): string =>
  path.join(os.homedir(), ".mediaplay-encode", "locks");

export const getTargetPathHash = (targetPath: string): string => {
  const normalizedTargetPath = path.resolve(targetPath);
  return crypto.createHash("sha256").update(normalizedTargetPath).digest("hex");
};

export const getLockPath = (targetPath: string, lockDir: string): string => {
  const resolvedLockDir = path.resolve(expandHome(lockDir));
  return path.join(resolvedLockDir, `${getTargetPathHash(targetPath)}.lock`);
};

const getLockAgeMs = async (lockPath: string): Promise<number | null> => {
  try {
    const [stats, rawMetadata] = await Promise.all([
      stat(lockPath),
      readFile(lockPath, "utf8").catch(() => null),
    ]);

    let lastActiveMs = stats.mtimeMs;

    if (rawMetadata) {
      try {
        const metadata = JSON.parse(rawMetadata) as Partial<StoredLockMetadata>;
        if (typeof metadata.lastHeartbeatAt === "string") {
          const heartbeatMs = Date.parse(metadata.lastHeartbeatAt);
          if (!Number.isNaN(heartbeatMs)) {
            lastActiveMs = Math.max(lastActiveMs, heartbeatMs);
          }
        }
      } catch {
        // Fall back to mtime for malformed lock files.
      }
    }

    return Date.now() - lastActiveMs;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const isLockStale = async (
  lockPath: string,
  staleTimeoutMs: number,
): Promise<boolean> => {
  const ageMs = await getLockAgeMs(lockPath);
  return ageMs !== null && ageMs > staleTimeoutMs;
};

const removeLockIfStale = async (
  lockPath: string,
  staleTimeoutMs: number,
): Promise<boolean> => {
  if (!(await isLockStale(lockPath, staleTimeoutMs))) {
    return false;
  }

  try {
    await rm(lockPath);
    logger.debug(`Removed stale lock: ${lockPath}`);
    return true;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return true;
    }
    throw error;
  }
};

const createStoredMetadata = (
  metadata: LockMetadata,
): StoredLockMetadata => {
  const now = new Date().toISOString();

  return {
    ...metadata,
    lockId: crypto.randomUUID(),
    pid: process.pid,
    hostname: os.hostname(),
    createdAt: now,
    lastHeartbeatAt: now,
  };
};

const readStoredMetadata = async (
  lockPath: string,
): Promise<StoredLockMetadata | null> => {
  try {
    return JSON.parse(await readFile(lockPath, "utf8")) as StoredLockMetadata;
  } catch {
    return null;
  }
};

const createLockHandle = (
  lockPath: string,
  metadata: StoredLockMetadata,
): LockHandle => {
  let heartbeat: NodeJS.Timeout | null = null;

  const release = async (): Promise<void> => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }

    const currentMetadata = await readStoredMetadata(lockPath);
    if (currentMetadata?.lockId !== metadata.lockId) {
      return;
    }

    try {
      await rm(lockPath);
    } catch (error) {
      if (!isErrorWithCode(error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  };

  const refresh = async (): Promise<void> => {
    const currentMetadata = await readStoredMetadata(lockPath);
    if (currentMetadata?.lockId !== metadata.lockId) {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      return;
    }

    const heartbeatMs = Date.now();
    await utimes(lockPath, heartbeatMs / 1000, heartbeatMs / 1000);
  };

  return {
    lockPath,
    metadata,
    startHeartbeat: () => {
      if (heartbeat) {
        return;
      }
      const heartbeatIntervalMs = Math.max(
        MIN_HEARTBEAT_INTERVAL_MS,
        Math.min(
          MAX_HEARTBEAT_INTERVAL_MS,
          Math.floor(metadata.staleTimeoutMs / 2),
        ),
      );
      heartbeat = setInterval(() => {
        refresh().catch((error: unknown) => {
          logger.warn(
            `Could not refresh lock ${lockPath}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }, heartbeatIntervalMs);
      heartbeat.unref();
    },
    release,
  };
};

const acquireNewLock = async (
  lockPath: string,
  metadata: LockMetadata,
): Promise<LockHandle> => {
  await mkdir(path.dirname(lockPath), { recursive: true });
  const storedMetadata = createStoredMetadata(metadata);
  const fileHandle = await open(lockPath, "wx");

  try {
    await fileHandle.writeFile(`${JSON.stringify(storedMetadata, null, 2)}\n`);
  } finally {
    await fileHandle.close();
  }

  return createLockHandle(lockPath, storedMetadata);
};

export const tryAcquireLock = async (
  lockPath: string,
  metadata: LockMetadata,
  staleTimeoutMs: number,
): Promise<LockHandle | null> => {
  try {
    return await acquireNewLock(lockPath, metadata);
  } catch (error) {
    if (!isErrorWithCode(error) || error.code !== "EEXIST") {
      throw error;
    }
  }

  if (!(await removeLockIfStale(lockPath, staleTimeoutMs))) {
    return null;
  }

  try {
    return await acquireNewLock(lockPath, metadata);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "EEXIST") {
      return null;
    }
    throw error;
  }
};

export const isLocked = async (
  lockPath: string,
  staleTimeoutMs: number,
): Promise<boolean> => {
  try {
    await stat(lockPath);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  return !(await removeLockIfStale(lockPath, staleTimeoutMs));
};

export const cleanupStaleLocks = async (
  lockDir: string,
  staleTimeoutMs: number,
): Promise<number> => {
  const resolvedLockDir = path.resolve(expandHome(lockDir));
  await mkdir(resolvedLockDir, { recursive: true });
  const lockFileNames = await readdir(resolvedLockDir);
  let removedCount = 0;

  for (const lockFileName of lockFileNames) {
    if (!lockFileName.endsWith(".lock")) {
      continue;
    }

    const lockPath = path.join(resolvedLockDir, lockFileName);
    if (await removeLockIfStale(lockPath, staleTimeoutMs)) {
      removedCount++;
    }
  }

  return removedCount;
};
