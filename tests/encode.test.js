const fs = require("fs-extra");
const { cli, fixturePath, cleanGeneratedFiles } = require("./utils");

jest.setTimeout(40000);

describe("Mediaplay encode", () => {
  let result;

  describe("Printing help", () => {
    beforeAll(async () => {
      result = await cli(["-h"]);
    });

    it("Should exit with 0", async () => {
      expect(result.code).toBe(0);
    });

    it("Should print help/instructions", async () => {
      expect(result.stdout).toContain(
        "Usage: mediaplay-encode [options] [path]"
      );
    });
  });

  describe("Encoding a valid path to mp4", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok"]);
    });

    it("Should keep original file", async () => {
      expect(await fs.pathExists(fixturePath("ok/mov_bbb.mp4"))).toBe(true);
    });

    it("Should have generated an encoded file", async () => {
      expect(await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4"))).toBe(
        true
      );
    });
  });

  describe("Encoding a valid path to mp4 through a temporary directory", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok", "--work-dir", "tmp"]);
    });

    it("Should keep original file", async () => {
      expect(await fs.pathExists(fixturePath("ok/mov_bbb.mp4"))).toBe(true);
    });

    it("Should have generated an encoded file", async () => {
      expect(await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4"))).toBe(
        true
      );
    });
  });

  describe("Encoding a valid uppercase path to mp4", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("uppercase");
      result = await cli(["uppercase"]);
    });

    it("Should keep original file", async () => {
      expect(await fs.pathExists(fixturePath("uppercase/MOV_BBB.MP4"))).toBe(
        true
      );
    });

    it("Should have generated an encoded file", async () => {
      expect(
        await fs.pathExists(fixturePath("uppercase/MOV_BBB.enc1.mp4"))
      ).toBe(true);
    });
  });

  describe("Passing the flag for deleting original files", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("ok");
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_deleteme.mp4")
      );
      result = await cli(["--delete-source", "ok/mov_bbb_deleteme.mp4"]);
    });

    it("Should delete original file", async () => {
      expect(await fs.pathExists(fixturePath("ok/mov_bbb_deleteme.mp4"))).toBe(
        false
      );
    });

    it("Should have generated an encoded file", async () => {
      expect(
        await fs.pathExists(fixturePath("ok/mov_bbb_deleteme.enc1.mp4"))
      ).toBe(true);
    });
  });

  describe("Passing the flag for deleting original files when encoding fails", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("invalid");
      await fs.remove(fixturePath("invalid/invalid_deleteme.mp4"));
      await fs.copyFile(
        fixturePath("invalid/invalid.mp4"),
        fixturePath("invalid/invalid_deleteme.mp4")
      );
      result = await cli(["--delete-source", "invalid/invalid_deleteme.mp4"]);
    });

    it("Should keep original file", async () => {
      expect(
        await fs.pathExists(fixturePath("invalid/invalid_deleteme.mp4"))
      ).toBe(true);
    });

    it("Should have generated a failed file", async () => {
      expect(
        await fs.pathExists(
          fixturePath("invalid/invalid_deleteme.enc1.mp4.failed")
        )
      ).toBe(true);
    });
  });

  describe("Passing a path with already in-progress files to encode", () => {
    beforeAll(async () => {
      result = await cli(["in-progress"]);
    });

    it("Should have not generated a failure file", async () => {
      expect(
        await fs.pathExists(
          fixturePath("in-progress/in-progress.enc1.mp4.failed")
        )
      ).toBe(false);
    });

    it("should have not encoded the file", async () => {
      expect(
        await fs.pathExists(fixturePath("in-progress/in-progress.enc1.mp4"))
      ).toBe(false);
    });

    it("should have not modified the already existing in-progress file", async () => {
      const contents = await fs.readFile(
        fixturePath("in-progress/.in-progress.enc1.mp4.tmp"),
        "utf8"
      );
      expect(contents).toEqual("An in-progress file\n");
    });
  });

  describe("Passing a path with hidden files to encode", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("hidden");
      result = await cli(["hidden"]);
    });

    it("Should keep original file", async () => {
      expect(await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.mp4"))).toBe(
        true
      );
    });

    it("Should have not generated an encoded file", async () => {
      expect(
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.enc1.mp4"))
      ).toBe(false);
    });

    it("Should have not generated a failure file", async () => {
      expect(
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.enc1.mp4.failed"))
      ).toBe(false);
    });
  });

  describe("Passing a path with invalid files to encode", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("invalid");
      result = await cli(["invalid"]);
    });

    it("Should keep original file", async () => {
      expect(await fs.pathExists(fixturePath("invalid/invalid.mp4"))).toBe(
        true
      );
    });

    it("Should not have generated an encoded files", async () => {
      expect(await fs.pathExists(fixturePath("invalid/invalid.enc1.mp4"))).toBe(
        false
      );
    });

    it("Should have generated an invalid encoding file", async () => {
      expect(
        await fs.pathExists(fixturePath("invalid/invalid.enc1.mp4.failed"))
      ).toBe(true);
    });
  });

  describe("Exit status when no files are found and looping is disabled", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("hidden");
      // Test with hidden directory which contains no encodable files
      result = await cli(["hidden"]);
    });

    it("Should exit with status 1 when no files are encoded", async () => {
      expect(result.code).toBe(1);
    });

    it("Should not have generated any encoded files", async () => {
      expect(
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.enc1.mp4"))
      ).toBe(false);
    });
  });

  describe("Exit status when files are found and encoded", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok"]);
    });

    it("Should exit with status 0 when files are encoded", async () => {
      expect(result.code).toBe(0);
    });

    it("Should have generated an encoded file", async () => {
      expect(await fs.pathExists(fixturePath("ok/mov_bbb.enc1.mp4"))).toBe(
        true
      );
    });
  });

  describe("Processing only one file with --one option", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("ok");
      
      // Create multiple test files to ensure only one gets processed
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_copy1.mp4")
      );
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_copy2.mp4")
      );
      
      result = await cli(["--one", "ok"]);
    });

    afterAll(async () => {
      // Clean up the test files we created
      await fs.remove(fixturePath("ok/mov_bbb_copy1.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy2.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy1.enc1.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy2.enc1.mp4"));
    });

    it("Should exit with status 0 when one file is encoded", async () => {
      expect(result.code).toBe(0);
    });

    it("Should process exactly one file", async () => {
      const encodedFiles = await fs.readdir(fixturePath("ok"));
      const encodedCount = encodedFiles.filter(file => file.includes('.enc1.')).length;
      expect(encodedCount).toBe(1);
    });

    it("Should leave other files unprocessed", async () => {
      // At least one of the original files should still exist without encoding
      const originalFiles = [
        "mov_bbb.mp4",
        "mov_bbb_copy1.mp4", 
        "mov_bbb_copy2.mp4"
      ];
      
      let unprocessedCount = 0;
      for (const file of originalFiles) {
        const originalExists = await fs.pathExists(fixturePath(`ok/${file}`));
        const encodedExists = await fs.pathExists(fixturePath(`ok/${file.replace('.mp4', '.enc1.mp4')}`));
        if (originalExists && !encodedExists) {
          unprocessedCount++;
        }
      }
      
      expect(unprocessedCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Processing only one file with -o option", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("ok");
      
      // Create multiple test files to ensure only one gets processed
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_copy3.mp4")
      );
      await fs.copyFile(
        fixturePath("ok/mov_bbb.mp4"),
        fixturePath("ok/mov_bbb_copy4.mp4")
      );
      
      result = await cli(["-o", "ok"]);
    });

    afterAll(async () => {
      // Clean up the test files we created
      await fs.remove(fixturePath("ok/mov_bbb_copy3.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy4.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy3.enc1.mp4"));
      await fs.remove(fixturePath("ok/mov_bbb_copy4.enc1.mp4"));
    });

    it("Should exit with status 0 when one file is encoded", async () => {
      expect(result.code).toBe(0);
    });

    it("Should process exactly one file", async () => {
      const encodedFiles = await fs.readdir(fixturePath("ok"));
      const encodedCount = encodedFiles.filter(file => file.includes('.enc1.')).length;
      expect(encodedCount).toBe(1);
    });
  });

  describe("Exit status when looping is enabled", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("hidden");
      // Test with loop interval of 1 second, but we'll kill it quickly
      // Since this would run indefinitely, we need to handle it differently
      result = await new Promise((resolve) => {
        const { exec } = require("child_process");
        const child = exec(
          `${require("path").join(__dirname, "../bin/mediaplay-encode.js")} --loop-interval 1 hidden`,
          { cwd: fixturePath(".") },
          (error, stdout, stderr) => {
            resolve({
              code: error && error.code ? error.code : 0,
              error,
              stdout,
              stderr,
            });
          }
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
      expect(result.code).not.toBe(1);
    });
  });
});
