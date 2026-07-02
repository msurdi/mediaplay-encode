import { exec } from "node:child_process";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import {
  binPath,
  cli,
  fixturePath,
  cleanGeneratedFiles,
  type CliResult,
} from "./utils.ts";

const oldWorkFileDate = (): Date =>
  new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

describe("Mediaplay encode", { timeout: 40000 }, () => {
  let result: CliResult;

  describe("Printing help", () => {
    before(async () => {
      result = await cli(["-h"]);
    });

    it("Should exit with 0", async () => {
      assert.equal(result.code, 0);
    });

    it("Should print help/instructions", async () => {
      assert.ok(
        result.stdout.includes("Usage: mediaplay-encode [options] [path]"),
      );
      assert.ok(result.stdout.includes("-t, --timeout <timeout>"));
      assert.ok(result.stdout.includes("Timeout for ffmpeg/ffprobe commands"));
      assert.ok(result.stdout.includes("-P, --no-progress"));
    });
  });

  describe("Encoding a valid path to mp4", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok"]);
    });

    it("Should keep original file", async () => {
      assert.equal(await fs.pathExists(fixturePath("ok/mov_bbb.mp4")), true);
    });

    it("Should have generated an encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4")),
        true,
      );
    });
  });

  describe("Encoding a valid path to mp4 with timeout", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok", "--timeout", "30m"]);
    });

    it("Should keep original file", async () => {
      assert.equal(await fs.pathExists(fixturePath("ok/mov_bbb.mp4")), true);
    });

    it("Should have generated an encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4")),
        true,
      );
    });

    it("Should exit with status 0", async () => {
      assert.equal(result.code, 0);
    });
  });

  describe("Encoding a valid path to mp4 without progress output", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok", "-P"]);
    });

    it("Should have generated an encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4")),
        true,
      );
    });

    it("Should not write interactive progress output", async () => {
      assert.ok(!result.stdout.includes("\r"));
      assert.ok(!result.stdout.includes("Encoding completed successfully"));
      assert.ok(!result.stdout.includes("█"));
      assert.ok(!result.stdout.includes("░"));
    });
  });

  describe("Encoding a valid path to mp4 through a temporary directory", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok", "--work-dir", "tmp"]);
    });

    it("Should keep original file", async () => {
      assert.equal(await fs.pathExists(fixturePath("ok/mov_bbb.mp4")), true);
    });

    it("Should have generated an encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4")),
        true,
      );
    });
  });

  describe("Invalid timeout format", () => {
    before(async () => {
      result = await cli(["ok", "--timeout", "invalid"]);
    });

    it("Should exit with error code", async () => {
      assert.notEqual(result.code, 0);
    });

    it("Should show error message about invalid timeout format", async () => {
      assert.ok(
        (result.stdout || result.stderr).includes("Invalid timeout format"),
      );
    });
  });

  describe("Encoding a valid uppercase path to mp4", () => {
    before(async () => {
      await cleanGeneratedFiles("uppercase");
      result = await cli(["uppercase"]);
    });

    it("Should keep original file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("uppercase/MOV_BBB.MP4")),
        true,
      );
    });

    it("Should have generated an encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("uppercase/MOV_BBB.enc1.mp4")),
        true,
      );
    });
  });

  describe("Encoding with very short timeout", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok", "--timeout", "1ms"]);
    });

    it("Should not exit with status 0 due to timeout", async () => {
      assert.notEqual(result.code, 0);
    });

    it("Should have generated a failed file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4.failed")),
        true,
      );
    });

    it("Should keep original file", async () => {
      assert.equal(await fs.pathExists(fixturePath("ok/mov_bbb.mp4")), true);
    });
  });

  describe("Passing the flag for deleting original files", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_deleteme.mp4"),
      );
      result = await cli(["--delete-source", "ok/mov_bbb_deleteme.mp4"]);
    });

    it("Should delete original file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb_deleteme.mp4")),
        false,
      );
    });

    it("Should have generated an encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb_deleteme.enc1.mp4")),
        true,
      );
    });
  });

  describe("Passing the flag for deleting original files when encoding fails", () => {
    before(async () => {
      await cleanGeneratedFiles("invalid");
      await fs.remove(fixturePath("invalid/invalid_deleteme.mp4"));
      await fs.copyFile(
        fixturePath("invalid/invalid.mp4"),
        fixturePath("invalid/invalid_deleteme.mp4"),
      );
      result = await cli(["--delete-source", "invalid/invalid_deleteme.mp4"]);
    });

    it("Should keep original file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("invalid/invalid_deleteme.mp4")),
        true,
      );
    });

    it("Should have generated a failed file", async () => {
      assert.equal(
        await fs.pathExists(
          fixturePath("invalid/invalid_deleteme.enc1.mp4.failed"),
        ),
        true,
      );
    });
  });

  describe("Passing a path with already in-progress files to encode", () => {
    before(async () => {
      await fs.remove(fixturePath("in-progress/in-progress.enc1.mp4"));
      await fs.outputFile(
        fixturePath("in-progress/.in-progress.enc1.mp4.tmp"),
        "An in-progress file\n",
      );
      result = await cli(["in-progress"]);
    });

    after(async () => {
      await fs.remove(fixturePath("in-progress/in-progress.enc1.mp4"));
    });

    it("Should have not generated a failure file", async () => {
      assert.equal(
        await fs.pathExists(
          fixturePath("in-progress/in-progress.enc1.mp4.failed"),
        ),
        false,
      );
    });

    it("should have not encoded the file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("in-progress/in-progress.enc1.mp4")),
        false,
      );
    });

    it("should have not modified the already existing in-progress file", async () => {
      const contents = await fs.readFile(
        fixturePath("in-progress/.in-progress.enc1.mp4.tmp"),
        "utf8",
      );
      assert.equal(contents, "An in-progress file\n");
    });
  });

  describe("Passing a path with stale in-progress files to encode", () => {
    before(async () => {
      const staleTmpPath = fixturePath("ok/.mov_bbb.enc1.mp4.tmp");
      await cleanGeneratedFiles("ok");
      await fs.outputFile(staleTmpPath, "A stale in-progress file\n");
      await fs.utimes(staleTmpPath, oldWorkFileDate(), oldWorkFileDate());
      result = await cli(["ok"]);
    });

    after(async () => {
      await cleanGeneratedFiles("ok");
    });

    it("Should remove the stale in-progress file and encode", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/.mov_bbb.enc1.mp4.tmp")),
        false,
      );
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4")),
        true,
      );
    });
  });

  describe("Passing a path with hidden files to encode", () => {
    before(async () => {
      await cleanGeneratedFiles("hidden");
      result = await cli(["hidden"]);
    });

    it("Should keep original file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.mp4")),
        true,
      );
    });

    it("Should have not generated an encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.enc1.mp4")),
        false,
      );
    });

    it("Should have not generated a failure file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.enc1.mp4.failed")),
        false,
      );
    });
  });

  describe("Passing a path with invalid files to encode", () => {
    before(async () => {
      await cleanGeneratedFiles("invalid");
      result = await cli(["invalid"]);
    });

    it("Should keep original file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("invalid/invalid.mp4")),
        true,
      );
    });

    it("Should not have generated an encoded files", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("invalid/invalid.enc1.mp4")),
        false,
      );
    });

    it("Should have generated an invalid encoding file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("invalid/invalid.enc1.mp4.failed")),
        true,
      );
    });
  });

  describe("Encoding failure with locks", () => {
    let result: CliResult;
    const lockDir = fixturePath("tmp-locks-invalid");

    before(async () => {
      await cleanGeneratedFiles("invalid");
      await fs.remove(lockDir);
      result = await cli(["-P", "--lock-dir", lockDir, "invalid"]);
    });

    after(async () => {
      await fs.remove(lockDir);
      await cleanGeneratedFiles("invalid");
    });

    it("Should fail encoding and leave a failed marker", async () => {
      assert.notEqual(result.code, 0);
      assert.equal(
        await fs.pathExists(fixturePath("invalid/invalid.enc1.mp4.failed")),
        true,
      );
    });

    it("Should remove the lock after failure", async () => {
      assert.deepEqual(await fs.readdir(lockDir), []);
    });
  });

  describe("Exit status when no files are found and looping is disabled", () => {
    before(async () => {
      await cleanGeneratedFiles("hidden");
      // Test with hidden directory which contains no encodable files
      result = await cli(["hidden"]);
    });

    it("Should exit with status 1 when no files are encoded", async () => {
      assert.equal(result.code, 1);
    });

    it("Should not have generated any encoded files", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.enc1.mp4")),
        false,
      );
    });
  });

  describe("Exit status when files are found and encoded", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok"]);
    });

    it("Should exit with status 0 when files are encoded", async () => {
      assert.equal(result.code, 0);
    });

    it("Should have generated an encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4")),
        true,
      );
    });
  });

  describe("Processing only one file with --one option", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");

      // Create multiple test files to ensure only one gets processed
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_copy1.mp4"),
      );
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_copy2.mp4"),
      );

      result = await cli(["--one", "ok"]);
    });

    after(async () => {
      // Clean up the test files we created
      await fs.remove(fixturePath("ok/mov_bbb_copy1.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy2.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy1.enc1.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy2.enc1.mp4"));
    });

    it("Should exit with status 0 when one file is encoded", async () => {
      assert.equal(result.code, 0);
    });

    it("Should process exactly one file", async () => {
      const encodedFiles = await fs.readdir(fixturePath("ok"));
      const encodedCount = encodedFiles.filter((file) =>
        file.includes(".enc1."),
      ).length;
      assert.equal(encodedCount, 1);
    });

    it("Should leave other files unprocessed", async () => {
      // At least one of the original files should still exist without encoding
      const originalFiles = [
        "mov_bbb.mp4",
        "mov_bbb_copy1.mp4",
        "mov_bbb_copy2.mp4",
      ];

      let unprocessedCount = 0;
      for (const file of originalFiles) {
        const originalExists = await fs.pathExists(fixturePath(`ok/${file}`));
        const encodedExists = await fs.pathExists(
          fixturePath(`ok/${file.replace(".mp4", ".enc1.mp4")}`),
        );
        if (originalExists && !encodedExists) {
          unprocessedCount++;
        }
      }

      assert.ok(unprocessedCount >= 2);
    });
  });

  describe("Processing only one file with -o option", () => {
    before(async () => {
      await cleanGeneratedFiles("ok");

      // Create multiple test files to ensure only one gets processed
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_copy3.mp4"),
      );
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_copy4.mp4"),
      );

      result = await cli(["-o", "ok"]);
    });

    after(async () => {
      // Clean up the test files we created
      await fs.remove(fixturePath("ok/mov_bbb_copy3.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy4.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy3.enc1.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy4.enc1.mp4"));
    });

    it("Should exit with status 0 when one file is encoded", async () => {
      assert.equal(result.code, 0);
    });

    it("Should process exactly one file", async () => {
      const encodedFiles = await fs.readdir(fixturePath("ok"));
      const encodedCount = encodedFiles.filter((file) =>
        file.includes(".enc1."),
      ).length;
      assert.equal(encodedCount, 1);
    });
  });

  describe("Concurrent executions against the same file", () => {
    let results: CliResult[];
    const lockDir = fixturePath("tmp-locks-concurrent");

    before(async () => {
      await cleanGeneratedFiles("ok");
      await fs.remove(lockDir);

      results = await Promise.all([
        cli(["-P", "--lock-dir", lockDir, "ok"]),
        cli(["-P", "--lock-dir", lockDir, "ok"]),
        cli(["-P", "--lock-dir", lockDir, "ok"]),
      ]);
    });

    after(async () => {
      await fs.remove(lockDir);
      await cleanGeneratedFiles("ok");
    });

    it("Should have one successful encoder", async () => {
      assert.equal(
        results.filter((result) => result.code === 0).length,
        1,
      );
    });

    it("Should produce exactly one encoded file", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4")),
        true,
      );
    });

    it("Should not leave race artifacts behind", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4.failed")),
        false,
      );
      assert.equal(
        await fs.pathExists(fixturePath("ok/.mov_bbb.enc1.mp4.tmp")),
        false,
      );
      assert.deepEqual(await fs.readdir(lockDir), []);
    });
  });

  describe("Concurrent executions with a shared work directory", () => {
    let results: CliResult[];
    const fixtureDir = fixturePath("same-basename");
    const lockDir = fixturePath("tmp-locks-same-basename");
    const workDir = fixturePath("tmp-work-same-basename");

    before(async () => {
      await fs.remove(fixtureDir);
      await fs.remove(lockDir);
      await fs.remove(workDir);
      await fs.ensureDir(fixturePath("same-basename/a"));
      await fs.ensureDir(fixturePath("same-basename/b"));
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("same-basename/a/movie.mp4"),
      );
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("same-basename/b/movie.mp4"),
      );

      results = await Promise.all([
        cli([
          "-P",
          "--lock-dir",
          lockDir,
          "--work-dir",
          workDir,
          "same-basename/a/movie.mp4",
        ]),
        cli([
          "-P",
          "--lock-dir",
          lockDir,
          "--work-dir",
          workDir,
          "same-basename/b/movie.mp4",
        ]),
      ]);
    });

    after(async () => {
      await fs.remove(fixtureDir);
      await fs.remove(lockDir);
      await fs.remove(workDir);
    });

    it("Should allow both encoders to complete", async () => {
      assert.deepEqual(
        results.map((result) => result.code),
        [0, 0],
      );
    });

    it("Should encode both same-basename files", async () => {
      assert.equal(
        await fs.pathExists(fixturePath("same-basename/a/movie.enc1.mp4")),
        true,
      );
      assert.equal(
        await fs.pathExists(fixturePath("same-basename/b/movie.enc1.mp4")),
        true,
      );
    });

    it("Should not leave work or lock files behind", async () => {
      assert.deepEqual(await fs.readdir(workDir), []);
      assert.deepEqual(await fs.readdir(lockDir), []);
    });
  });

  describe("Exit status when looping is enabled", () => {
    before(async () => {
      await cleanGeneratedFiles("hidden");
      // Test with loop interval of 1 second, but we'll kill it quickly
      // Since this would run indefinitely, we need to handle it differently
      result = await new Promise<CliResult>((resolve) => {
        const child = exec(
          `${binPath} --loop-interval 1 hidden`,
          { cwd: fixturePath(".") },
          (error, stdout, stderr) => {
            resolve({
              code: error?.code ? error.code : 0,
              error,
              stdout,
              stderr,
            });
          },
        );

        // Kill the process after a short delay to simulate stopping the loop
        setTimeout(() => {
          child.kill("SIGTERM");
        }, 2000);
      });
    });

    it("Should not exit with status 1 when looping is enabled (even with no files)", async () => {
      // When killed with SIGTERM, the exit code is typically 143 (128 + 15)
      // The important thing is that it's NOT 1 (which would indicate our "no files encoded" logic)
      assert.notEqual(result.code, 1);
    });
  });
});
