import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import size from "./size.ts";

const TEST_FILE_PATH = path.join(
  import.meta.dirname,
  "../../tests/fixtures/ok/mov_bbb.mp4",
);

describe("size", () => {
  it("Returns correct size for a file", async () => {
    assert.equal(await size(TEST_FILE_PATH), "788.49 kB");
  });
});
