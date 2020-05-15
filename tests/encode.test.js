const fs = require("fs-extra");

const { cli, fixturePath, cleanGeneratedFiles } = require("./utils");

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

  describe("Passing a path with valid files to encode", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("ok");
      result = await cli(["ok"]);
    });

    it("Should keep original file", async () => {
      expect(await fs.exists(fixturePath("ok/mov_bbb.mp4"))).toBe(true);
    });

    it("Should have generated an encoded file", async () => {
      expect(await fs.exists(fixturePath("ok/mov_bbb.enc.mp4"))).toBe(true);
    });
  });

  describe("Passing a path with already in-progress files to encode", () => {
    beforeAll(async () => {
      result = await cli(["in-progress"]);
    });

    it("Should have not generated a failure file", async () => {
      expect(
        await fs.exists(fixturePath("in-progress/in-progress.enc.mp4.failed"))
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
      expect(await fs.exists(fixturePath("hidden/.dir/mov_bbb.mp4"))).toBe(
        true
      );
    });

    it("Should have not generated an encoded file", async () => {
      expect(await fs.exists(fixturePath("hidden/.dir/mov_bbb.enc.mp4"))).toBe(
        false
      );
    });

    it("Should have not generated a failure file", async () => {
      expect(
        await fs.exists(fixturePath("hidden/.dir/mov_bbb.enc.mp4.failed"))
      ).toBe(false);
    });
  });

  describe("Passing a path with invalid files to encode", () => {
    beforeAll(async () => {
      await cleanGeneratedFiles("invalid");
      result = await cli(["invalid"]);
    });

    it("Should keep original file", async () => {
      expect(await fs.exists(fixturePath("invalid/invalid.mp4"))).toBe(true);
    });

    it("Should not have generated an encoded files", async () => {
      expect(await fs.exists(fixturePath("invalid/invalid.enc.mp4"))).toBe(
        false
      );
    });

    it("Should have generated an invalid encoding file", async () => {
      expect(
        await fs.exists(fixturePath("invalid/invalid.enc.mp4.failed"))
      ).toBe(true);
    });
  });
});
