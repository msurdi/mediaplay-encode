const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const size = require("./size");

const TEST_FILE_PATH = path.join(
  __dirname,
  "../../tests/fixtures/ok/mov_bbb.mp4",
);

describe("size", () => {
  it("Returns correct size for a file", async () => {
    assert.equal(await size(TEST_FILE_PATH), "788.49 kB");
  });
});
