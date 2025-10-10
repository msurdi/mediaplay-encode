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
        "Usage: mediaplay-encode [options] [paths...]"
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
      expect(await fs.pathExists(fixturePath("ok/mov_bbb.enc.mp4"))).toBe(true);
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
      expect(await fs.pathExists(fixturePath("ok/mov_bbb.enc.mp4"))).toBe(true);
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
        await fs.pathExists(fixturePath("uppercase/MOV_BBB.enc.mp4"))
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
        await fs.pathExists(fixturePath("ok/mov_bbb_deleteme.enc.mp4"))
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
          fixturePath("invalid/invalid_deleteme.enc.mp4.failed")
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
          fixturePath("in-progress/in-progress.enc.mp4.failed")
        )
      ).toBe(false);
    });

    it("should have not encoded the file", async () => {
      expect(
        await fs.pathExists(fixturePath("in-progress/in-progress.enc.mp4"))
      ).toBe(false);
    });

    it("should have not modified the already existing in-progress file", async () => {
      const contents = await fs.readFile(
        fixturePath("in-progress/.in-progress.enc.mp4.tmp"),
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
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.enc.mp4"))
      ).toBe(false);
    });

    it("Should have not generated a failure file", async () => {
      expect(
        await fs.pathExists(fixturePath("hidden/.dir/mov_bbb.enc.mp4.failed"))
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
      expect(await fs.pathExists(fixturePath("invalid/invalid.enc.mp4"))).toBe(
        false
      );
    });

    it("Should have generated an invalid encoding file", async () => {
      expect(
        await fs.pathExists(fixturePath("invalid/invalid.enc.mp4.failed"))
      ).toBe(true);
    });
  });
});
