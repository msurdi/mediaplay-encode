import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import {
  cleanupStaleLocks,
  getLockPath,
  getTargetPathHash,
  isLocked,
  tryAcquireLock,
} from "./locks.ts";

const staleTimeoutMs = 60 * 1000;

const oldDate = (): Date => new Date(Date.now() - staleTimeoutMs * 2);

const createStaleLock = async (
  lockPath: string,
  metadata: Record<string, unknown> = {},
): Promise<void> => {
  const timestamp = oldDate().toISOString();
  await fs.outputFile(
    lockPath,
    `${JSON.stringify(
      {
        lockId: crypto.randomUUID(),
        pid: 123,
        hostname: "test-host",
        sourcePath: "/source.mp4",
        targetPath: "/target.enc1.mp4",
        staleTimeoutMs,
        createdAt: timestamp,
        lastHeartbeatAt: timestamp,
        ...metadata,
      },
      null,
      2,
    )}\n`,
  );
  await fs.utimes(lockPath, oldDate(), oldDate());
};

describe("locks service", () => {
  let tempDir: string;
  let lockDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mediaplay-locks-"));
    lockDir = path.join(tempDir, "locks");
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("creates lock paths from the SHA-256 hash of the target path", () => {
    const targetPath = path.join(tempDir, "video.enc1.mp4");
    const expectedHash = crypto
      .createHash("sha256")
      .update(path.resolve(targetPath))
      .digest("hex");

    assert.equal(getTargetPathHash(targetPath), expectedHash);
    assert.equal(
      getLockPath(targetPath, lockDir),
      path.join(lockDir, `${expectedHash}.lock`),
    );
    assert.notEqual(path.dirname(getLockPath(targetPath, lockDir)), tempDir);
  });

  it("allows only one active lock for a target", async () => {
    const lockPath = getLockPath(path.join(tempDir, "video.enc1.mp4"), lockDir);
    const metadata = {
      sourcePath: path.join(tempDir, "video.mp4"),
      targetPath: path.join(tempDir, "video.enc1.mp4"),
      staleTimeoutMs,
    };

    const firstLock = await tryAcquireLock(lockPath, metadata, staleTimeoutMs);
    const secondLock = await tryAcquireLock(lockPath, metadata, staleTimeoutMs);

    assert.notEqual(firstLock, null);
    assert.equal(secondLock, null);

    await firstLock?.release();
  });

  it("keeps fresh locks and removes stale locks", async () => {
    const freshLockPath = getLockPath(
      path.join(tempDir, "fresh.enc1.mp4"),
      lockDir,
    );
    const staleLockPath = getLockPath(
      path.join(tempDir, "stale.enc1.mp4"),
      lockDir,
    );
    const freshLock = await tryAcquireLock(
      freshLockPath,
      {
        sourcePath: path.join(tempDir, "fresh.mp4"),
        targetPath: path.join(tempDir, "fresh.enc1.mp4"),
        staleTimeoutMs,
      },
      staleTimeoutMs,
    );
    await createStaleLock(staleLockPath);

    const removedCount = await cleanupStaleLocks(lockDir, staleTimeoutMs);

    assert.equal(removedCount, 1);
    assert.equal(await fs.pathExists(freshLockPath), true);
    assert.equal(await fs.pathExists(staleLockPath), false);

    await freshLock?.release();
  });

  it("uses mtime to remove malformed stale lock files", async () => {
    const lockPath = getLockPath(
      path.join(tempDir, "malformed.enc1.mp4"),
      lockDir,
    );
    await fs.outputFile(lockPath, "not json");
    await fs.utimes(lockPath, oldDate(), oldDate());

    assert.equal(await cleanupStaleLocks(lockDir, staleTimeoutMs), 1);
    assert.equal(await fs.pathExists(lockPath), false);
  });

  it("reclaims a stale lock with a single winner under concurrency", async () => {
    const lockPath = getLockPath(path.join(tempDir, "video.enc1.mp4"), lockDir);
    const metadata = {
      sourcePath: path.join(tempDir, "video.mp4"),
      targetPath: path.join(tempDir, "video.enc1.mp4"),
      staleTimeoutMs,
    };
    await createStaleLock(lockPath);

    const locks = await Promise.all(
      Array.from({ length: 5 }, () =>
        tryAcquireLock(lockPath, metadata, staleTimeoutMs),
      ),
    );
    const winners = locks.filter((lock) => lock !== null);

    assert.equal(winners.length, 1);
    await winners[0]?.release();
  });

  it("removes released locks", async () => {
    const lockPath = getLockPath(path.join(tempDir, "video.enc1.mp4"), lockDir);
    const lock = await tryAcquireLock(
      lockPath,
      {
        sourcePath: path.join(tempDir, "video.mp4"),
        targetPath: path.join(tempDir, "video.enc1.mp4"),
        staleTimeoutMs,
      },
      staleTimeoutMs,
    );

    assert.equal(await isLocked(lockPath, staleTimeoutMs), true);
    await lock?.release();
    assert.equal(await fs.pathExists(lockPath), false);
  });
});
