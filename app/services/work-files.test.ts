import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import {
  getLockPath,
  getTargetPathHash,
  tryAcquireLock,
} from "./locks.ts";
import { cleanupStaleWorkFiles } from "./work-files.ts";
import {
  getTargetPathFromSourcePath,
  getWorkInProgressPathFromTargetPath,
} from "../utils/path.ts";

const staleTimeoutMs = 60 * 1000;
const encodedSuffix = ".enc1.mp4";

const oldDate = (): Date => new Date(Date.now() - staleTimeoutMs * 2);

const makeStale = async (entryPath: string): Promise<void> => {
  await fs.utimes(entryPath, oldDate(), oldDate());
};

describe("work files service", () => {
  let tempDir: string;
  let scanDir: string;
  let workDir: string;
  let lockDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mediaplay-work-"));
    scanDir = path.join(tempDir, "scan");
    workDir = path.join(tempDir, "work");
    lockDir = path.join(tempDir, "locks");
    await fs.ensureDir(scanDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  const cleanup = async (
    options: Partial<Parameters<typeof cleanupStaleWorkFiles>[0]> = {},
  ): Promise<number> =>
    cleanupStaleWorkFiles({
      scanPath: scanDir,
      encodedSuffix,
      workDir: "",
      staleTimeoutMs,
      lockDir,
      lockStaleTimeoutMs: staleTimeoutMs,
      ...options,
    });

  it("removes stale tmp files and keeps fresh or unrelated tmp files", async () => {
    const staleTmpPath = path.join(scanDir, ".old.enc1.mp4.tmp");
    const freshTmpPath = path.join(scanDir, ".fresh.enc1.mp4.tmp");
    const unrelatedTmpPath = path.join(scanDir, ".unrelated.tmp");

    await fs.outputFile(staleTmpPath, "stale");
    await fs.outputFile(freshTmpPath, "fresh");
    await fs.outputFile(unrelatedTmpPath, "unrelated");
    await makeStale(staleTmpPath);
    await makeStale(unrelatedTmpPath);

    assert.equal(await cleanup(), 1);
    assert.equal(await fs.pathExists(staleTmpPath), false);
    assert.equal(await fs.pathExists(freshTmpPath), true);
    assert.equal(await fs.pathExists(unrelatedTmpPath), true);
  });

  it("removes the matching stale tmp file when scanning a single source file", async () => {
    const sourcePath = path.join(scanDir, "video.mp4");
    const targetPath = getTargetPathFromSourcePath(sourcePath, encodedSuffix);
    const tmpPath = getWorkInProgressPathFromTargetPath(targetPath);

    await fs.outputFile(sourcePath, "source");
    await fs.outputFile(tmpPath, "stale");
    await makeStale(tmpPath);

    assert.equal(await cleanup({ scanPath: sourcePath }), 1);
    assert.equal(await fs.pathExists(tmpPath), false);
  });

  it("removes stale hashed work directory entries", async () => {
    const staleTargetPath = path.join(scanDir, "stale.enc1.mp4");
    const freshTargetPath = path.join(scanDir, "fresh.enc1.mp4");
    const staleJobDir = path.join(workDir, getTargetPathHash(staleTargetPath));
    const freshJobDir = path.join(workDir, getTargetPathHash(freshTargetPath));
    const unrelatedDir = path.join(workDir, "not-a-job");

    await fs.outputFile(path.join(staleJobDir, ".stale.enc1.mp4.tmp"), "stale");
    await fs.outputFile(path.join(freshJobDir, ".fresh.enc1.mp4.tmp"), "fresh");
    await fs.outputFile(path.join(unrelatedDir, "file.tmp"), "unrelated");
    await makeStale(path.join(staleJobDir, ".stale.enc1.mp4.tmp"));
    await makeStale(staleJobDir);
    await makeStale(unrelatedDir);

    assert.equal(await cleanup({ workDir }), 1);
    assert.equal(await fs.pathExists(staleJobDir), false);
    assert.equal(await fs.pathExists(freshJobDir), true);
    assert.equal(await fs.pathExists(unrelatedDir), true);
  });

  it("keeps stale tmp files protected by an active lock", async () => {
    const sourcePath = path.join(scanDir, "locked.mp4");
    const targetPath = getTargetPathFromSourcePath(sourcePath, encodedSuffix);
    const tmpPath = getWorkInProgressPathFromTargetPath(targetPath);
    const lock = await tryAcquireLock(
      getLockPath(targetPath, lockDir),
      {
        sourcePath,
        targetPath,
        staleTimeoutMs,
      },
      staleTimeoutMs,
    );

    await fs.outputFile(tmpPath, "stale but active");
    await makeStale(tmpPath);

    assert.equal(await cleanup(), 0);
    assert.equal(await fs.pathExists(tmpPath), true);

    await lock?.release();
  });

  it("keeps stale work directory entries protected by an active lock", async () => {
    const targetPath = path.join(scanDir, "locked.enc1.mp4");
    const lockedJobDir = path.join(workDir, getTargetPathHash(targetPath));
    const lock = await tryAcquireLock(
      getLockPath(targetPath, lockDir),
      {
        sourcePath: path.join(scanDir, "locked.mp4"),
        targetPath,
        staleTimeoutMs,
      },
      staleTimeoutMs,
    );

    await fs.outputFile(path.join(lockedJobDir, ".locked.enc1.mp4.tmp"), "stale");
    await makeStale(path.join(lockedJobDir, ".locked.enc1.mp4.tmp"));
    await makeStale(lockedJobDir);

    assert.equal(await cleanup({ workDir }), 0);
    assert.equal(await fs.pathExists(lockedJobDir), true);

    await lock?.release();
  });
});
