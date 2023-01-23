const path = require("path");
const size = require("./size");

const TEST_FILE_PATH = path.join(
  __dirname,
  "../../tests/fixtures/ok/mov_bbb.mp4"
);

describe("size", () => {
  it("Returns correct size for a file", async () => {
    expect(await size(TEST_FILE_PATH)).toEqual("788.49 kB");
  });
});
