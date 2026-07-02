import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTimeout, formatTimeout } from "./timeout.ts";

describe("timeout utility", () => {
  describe("parseTimeout", () => {
    it("should parse milliseconds correctly", () => {
      assert.equal(parseTimeout("500ms"), 500);
      assert.equal(parseTimeout("1000ms"), 1000);
      assert.equal(parseTimeout("1.5ms"), 1.5);
    });

    it("should parse seconds correctly", () => {
      assert.equal(parseTimeout("60s"), 60000);
      assert.equal(parseTimeout("30s"), 30000);
      assert.equal(parseTimeout("1.5s"), 1500);
    });

    it("should parse minutes correctly", () => {
      assert.equal(parseTimeout("5m"), 5 * 60 * 1000);
      assert.equal(parseTimeout("30m"), 30 * 60 * 1000);
      assert.equal(parseTimeout("1.5m"), 1.5 * 60 * 1000);
    });

    it("should parse hours correctly", () => {
      assert.equal(parseTimeout("2h"), 2 * 60 * 60 * 1000);
      assert.equal(parseTimeout("4h"), 4 * 60 * 60 * 1000);
      assert.equal(parseTimeout("1.5h"), 1.5 * 60 * 60 * 1000);
    });

    it("should parse days correctly", () => {
      assert.equal(parseTimeout("1d"), 24 * 60 * 60 * 1000);
      assert.equal(parseTimeout("2d"), 2 * 24 * 60 * 60 * 1000);
    });

    it("should default to seconds when no unit is provided", () => {
      assert.equal(parseTimeout("60"), 60000);
      assert.equal(parseTimeout("30"), 30000);
    });

    it("should handle case insensitive units", () => {
      assert.equal(parseTimeout("500MS"), 500);
      assert.equal(parseTimeout("5M"), 5 * 60 * 1000);
      assert.equal(parseTimeout("2H"), 2 * 60 * 60 * 1000);
      assert.equal(parseTimeout("60S"), 60000);
    });

    it("should handle whitespace", () => {
      assert.equal(parseTimeout(" 500ms "), 500);
      assert.equal(parseTimeout(" 5m "), 5 * 60 * 1000);
      assert.equal(parseTimeout("5 m"), 5 * 60 * 1000);
      assert.equal(parseTimeout(" 5 m "), 5 * 60 * 1000);
    });

    it("should return null for empty or invalid input", () => {
      assert.equal(parseTimeout(""), null);
      assert.equal(parseTimeout(null), null);
      assert.equal(parseTimeout(undefined), null);
      assert.equal(parseTimeout("   "), null);
    });

    it("should throw error for invalid format", () => {
      assert.throws(() => parseTimeout("abc"), /Invalid timeout format/);
      assert.throws(() => parseTimeout("5x"), /Invalid timeout format/);
      assert.throws(() => parseTimeout("5.5.5m"), /Invalid timeout format/);
      assert.throws(() => parseTimeout("-5m"), /Invalid timeout format/);
    });

    it("should throw error for zero or negative values", () => {
      assert.throws(
        () => parseTimeout("0s"),
        /Timeout must be a positive number/,
      );
      assert.throws(() => parseTimeout("-5m"), /Invalid timeout format/);
    });
  });

  describe("formatTimeout", () => {
    it("should format milliseconds correctly", () => {
      assert.equal(formatTimeout(500), "500.0ms");
      assert.equal(formatTimeout(1000), "1.0s");
      assert.equal(formatTimeout(1500), "1.5s");
    });

    it("should format minutes correctly", () => {
      assert.equal(formatTimeout(60 * 1000), "1.0m");
      assert.equal(formatTimeout(90 * 1000), "1.5m");
      assert.equal(formatTimeout(5 * 60 * 1000), "5.0m");
    });

    it("should format hours correctly", () => {
      assert.equal(formatTimeout(60 * 60 * 1000), "1.0h");
      assert.equal(formatTimeout(2.5 * 60 * 60 * 1000), "2.5h");
    });

    it("should format days correctly", () => {
      assert.equal(formatTimeout(24 * 60 * 60 * 1000), "1.0d");
      assert.equal(formatTimeout(2.5 * 24 * 60 * 60 * 1000), "2.5d");
    });

    it("should handle no timeout", () => {
      assert.equal(formatTimeout(0), "no timeout");
      assert.equal(formatTimeout(null), "no timeout");
      assert.equal(formatTimeout(undefined), "no timeout");
      assert.equal(formatTimeout(-1), "no timeout");
    });

    it("should choose the most appropriate unit", () => {
      assert.equal(formatTimeout(500), "500.0ms"); // 500ms -> milliseconds
      assert.equal(formatTimeout(45 * 1000), "45.0s"); // 45s -> seconds
      assert.equal(formatTimeout(2 * 60 * 1000), "2.0m"); // 2m -> minutes
      assert.equal(formatTimeout(3 * 60 * 60 * 1000), "3.0h"); // 3h -> hours
      assert.equal(formatTimeout(2 * 24 * 60 * 60 * 1000), "2.0d"); // 2d -> days
    });
  });
});
