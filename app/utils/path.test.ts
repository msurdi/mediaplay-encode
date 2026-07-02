import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import * as pathUtils from "./path.ts";

/*
Source path: Original file name or path
Target path: Target file name or path where the resulting process will be written to
Failed path: Target file name or path where a failed processing will be written to
Work in progress path: Temporary file name or path to be used while processing a file
*/

describe("Path utils", () => {
  describe("Failed paths and file names", () => {
    it("Creates correct failed path from a relative target path", () => {
      const failedPath = pathUtils.getFailedPathFromTargetPath("some/test.mp4");
      assert.equal(failedPath, "some/test.mp4.failed");
    });

    it("Creates correct failed path from a file name", () => {
      const failedPath = pathUtils.getFailedPathFromTargetPath("test.mp4");
      assert.equal(failedPath, "test.mp4.failed");
    });

    it("Creates correct failed path from am absolute path", () => {
      const failedPath = pathUtils.getFailedPathFromTargetPath(
        "/some/absolute/test.mp4",
      );
      assert.equal(failedPath, "/some/absolute/test.mp4.failed");
    });

    it("Does not create file names longer than 255 characters", () => {
      const failedPath = pathUtils.getFailedPathFromTargetPath(
        path.join("/some/absolute", "test.mp4".repeat(200)),
      );
      assert.ok(path.basename(failedPath).length <= 255);
    });
  });

  describe("Target paths and file names", () => {
    it("Creates a valid target path from a relative source path", () => {
      const targetPath = pathUtils.getTargetPathFromSourcePath(
        "other/test.mp4",
        ".enc.mp4",
      );
      assert.equal(targetPath, "other/test.enc.mp4");
    });

    it("Creates a valid target path from an absolute source path", () => {
      const targetPath = pathUtils.getTargetPathFromSourcePath(
        "/some/absolute/test.mp4",
        ".enc.mp4",
      );
      assert.equal(targetPath, "/some/absolute/test.enc.mp4");
    });

    it("Creates a valid target path from a file name", () => {
      const targetPath = pathUtils.getTargetPathFromSourcePath(
        "test.mp4",
        ".enc.mp4",
      );
      assert.equal(targetPath, "test.enc.mp4");
    });

    it("Creates a valid target path from a very long file name", () => {
      const targetPath = pathUtils.getTargetPathFromSourcePath(
        "test.mp4".repeat(200),
        ".enc.mp4",
      );
      assert.ok(path.basename(targetPath).length <= 255);
    });
  });

  describe("Work in progress paths and file names", () => {
    it("Creates a valid temporary path from a relative source path", () => {
      const workInProgressPath =
        pathUtils.getWorkInProgressPathFromTargetPath("other/test.mp4");
      assert.equal(workInProgressPath, "other/.test.mp4.tmp");
    });

    it("Creates a valid work in progress path from an absolute source path", () => {
      const workInProgressPath = pathUtils.getWorkInProgressPathFromTargetPath(
        "/some/absolute/test.mp4",
      );
      assert.equal(workInProgressPath, "/some/absolute/.test.mp4.tmp");
    });

    it("Creates a valid work in progress path from a file name", () => {
      const workInProgressPath =
        pathUtils.getWorkInProgressPathFromTargetPath("test.mp4");
      assert.equal(workInProgressPath, ".test.mp4.tmp");
    });

    it("Creates a valid work in progress path with limited length for long file names", () => {
      const workInProgressPath = pathUtils.getWorkInProgressPathFromTargetPath(
        "test.mp4".repeat(200),
      );
      assert.ok(workInProgressPath.length <= 255);
    });
  });
});
