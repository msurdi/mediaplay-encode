const fs = require("fs-extra");
const {
  cli,
  fixturesPath,
  cleanGeneratedFiles,
  getFixtureFilesPaths,
} = require("./utils");

describe("Mediaplay encode", () => {
  let result;
  let fixtureFilesPaths;

  beforeEach(async () => {
    await cleanGeneratedFiles();
    fixtureFilesPaths = await getFixtureFilesPaths();
    expect(fixtureFilesPaths.length).toBeGreaterThan(0);
  });

  describe("Printing help", () => {
    beforeEach(async () => {
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

  describe("Passing a path with files to encode", () => {
    beforeEach(async () => {
      result = await cli([fixturesPath]);
    });

    it("Should keep original files", async () => {
      for (const fixtureFilePath of fixtureFilesPaths) {
        expect(await fs.exists(fixtureFilePath)).toBe(true);
      }
    });

    it("Should have generated an encoded files", async () => {
      for (const fixtureFilePath of fixtureFilesPaths) {
        expect(await fs.exists(fixtureFilePath)).toBe(true);
      }
    });
  });
});
