const { parseTimeout, formatTimeout } = require("./timeout");

describe("timeout utility", () => {
  describe("parseTimeout", () => {
    it("should parse milliseconds correctly", () => {
      expect(parseTimeout("500ms")).toBe(500);
      expect(parseTimeout("1000ms")).toBe(1000);
      expect(parseTimeout("1.5ms")).toBe(1.5);
    });

    it("should parse seconds correctly", () => {
      expect(parseTimeout("60s")).toBe(60000);
      expect(parseTimeout("30s")).toBe(30000);
      expect(parseTimeout("1.5s")).toBe(1500);
    });

    it("should parse minutes correctly", () => {
      expect(parseTimeout("5m")).toBe(5 * 60 * 1000);
      expect(parseTimeout("30m")).toBe(30 * 60 * 1000);
      expect(parseTimeout("1.5m")).toBe(1.5 * 60 * 1000);
    });

    it("should parse hours correctly", () => {
      expect(parseTimeout("2h")).toBe(2 * 60 * 60 * 1000);
      expect(parseTimeout("4h")).toBe(4 * 60 * 60 * 1000);
      expect(parseTimeout("1.5h")).toBe(1.5 * 60 * 60 * 1000);
    });

    it("should parse days correctly", () => {
      expect(parseTimeout("1d")).toBe(24 * 60 * 60 * 1000);
      expect(parseTimeout("2d")).toBe(2 * 24 * 60 * 60 * 1000);
    });

    it("should default to seconds when no unit is provided", () => {
      expect(parseTimeout("60")).toBe(60000);
      expect(parseTimeout("30")).toBe(30000);
    });

    it("should handle case insensitive units", () => {
      expect(parseTimeout("500MS")).toBe(500);
      expect(parseTimeout("5M")).toBe(5 * 60 * 1000);
      expect(parseTimeout("2H")).toBe(2 * 60 * 60 * 1000);
      expect(parseTimeout("60S")).toBe(60000);
    });

    it("should handle whitespace", () => {
      expect(parseTimeout(" 500ms ")).toBe(500);
      expect(parseTimeout(" 5m ")).toBe(5 * 60 * 1000);
      expect(parseTimeout("5 m")).toBe(5 * 60 * 1000);
      expect(parseTimeout(" 5 m ")).toBe(5 * 60 * 1000);
    });

    it("should return null for empty or invalid input", () => {
      expect(parseTimeout("")).toBe(null);
      expect(parseTimeout(null)).toBe(null);
      expect(parseTimeout(undefined)).toBe(null);
      expect(parseTimeout("   ")).toBe(null);
    });

    it("should throw error for invalid format", () => {
      expect(() => parseTimeout("abc")).toThrow("Invalid timeout format");
      expect(() => parseTimeout("5x")).toThrow("Invalid timeout format");
      expect(() => parseTimeout("5.5.5m")).toThrow("Invalid timeout format");
      expect(() => parseTimeout("-5m")).toThrow("Invalid timeout format");
    });

    it("should throw error for zero or negative values", () => {
      expect(() => parseTimeout("0s")).toThrow(
        "Timeout must be a positive number"
      );
      expect(() => parseTimeout("-5m")).toThrow("Invalid timeout format");
    });
  });

  describe("formatTimeout", () => {
    it("should format milliseconds correctly", () => {
      expect(formatTimeout(500)).toBe("500.0ms");
      expect(formatTimeout(1000)).toBe("1.0s");
      expect(formatTimeout(1500)).toBe("1.5s");
    });

    it("should format minutes correctly", () => {
      expect(formatTimeout(60 * 1000)).toBe("1.0m");
      expect(formatTimeout(90 * 1000)).toBe("1.5m");
      expect(formatTimeout(5 * 60 * 1000)).toBe("5.0m");
    });

    it("should format hours correctly", () => {
      expect(formatTimeout(60 * 60 * 1000)).toBe("1.0h");
      expect(formatTimeout(2.5 * 60 * 60 * 1000)).toBe("2.5h");
    });

    it("should format days correctly", () => {
      expect(formatTimeout(24 * 60 * 60 * 1000)).toBe("1.0d");
      expect(formatTimeout(2.5 * 24 * 60 * 60 * 1000)).toBe("2.5d");
    });

    it("should handle no timeout", () => {
      expect(formatTimeout(0)).toBe("no timeout");
      expect(formatTimeout(null)).toBe("no timeout");
      expect(formatTimeout(undefined)).toBe("no timeout");
      expect(formatTimeout(-1)).toBe("no timeout");
    });

    it("should choose the most appropriate unit", () => {
      expect(formatTimeout(500)).toBe("500.0ms"); // 500ms -> milliseconds
      expect(formatTimeout(45 * 1000)).toBe("45.0s"); // 45s -> seconds
      expect(formatTimeout(2 * 60 * 1000)).toBe("2.0m"); // 2m -> minutes
      expect(formatTimeout(3 * 60 * 60 * 1000)).toBe("3.0h"); // 3h -> hours
      expect(formatTimeout(2 * 24 * 60 * 60 * 1000)).toBe("2.0d"); // 2d -> days
    });
  });
});
