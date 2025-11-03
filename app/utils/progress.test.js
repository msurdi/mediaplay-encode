const {
  parseProgress,
  parseProgressKeyValue,
  displayProgress,
  clearProgress,
  createProgressTracker,
} = require("./progress");

// Mock console.log and process.stdout.write for testing
const originalWrite = process.stdout.write;
const originalLog = console.log;
let mockOutput = "";

beforeEach(() => {
  mockOutput = "";
  process.stdout.write = jest.fn((data) => {
    mockOutput += data;
    return true;
  });
  console.log = jest.fn((data) => {
    mockOutput += `${data}\n`;
  });
});

afterEach(() => {
  process.stdout.write = originalWrite;
  console.log = originalLog;
});

describe("progress utility", () => {
  describe("parseProgress", () => {
    it("should parse ffmpeg progress from stderr", () => {
      const stderr = `
frame=  150 fps= 30 q=-0.0 size=    1024kB time=00:00:05.00 bitrate=1677.7kbits/s speed=1.2x
frame=  300 fps= 29 q=-0.0 size=    2048kB time=00:00:10.50 bitrate=1596.1kbits/s speed=1.1x
      `;

      const progress = parseProgress(stderr);

      expect(progress).toEqual({
        time: 10,
        frame: 300,
        fps: 29,
        size: 2048,
        speed: 1.1,
        timeFormatted: "00:00:10",
      });
    });

    it("should return empty object when no progress found", () => {
      const stderr = "Some random ffmpeg output without progress";
      const progress = parseProgress(stderr);
      expect(progress).toEqual({});
    });

    it("should handle corrupted frame output (ame= instead of frame=)", () => {
      const stderr = `
Output #0, mp4, to '/path/to/file.mp4':
 {ame=  302 fps=100 q=22.0 size=    3072KiB time=00:00:12.55 bitrate=2004.6kbits/s speed=4.14x elapsed=0:00:03.03
      `;

      const progress = parseProgress(stderr);

      expect(progress).toEqual({
        time: 12,
        frame: 302,
        fps: 100,
        size: 3072,
        speed: 4.14,
        timeFormatted: "00:00:12",
      });
    });
  });

  describe("parseProgressKeyValue", () => {
    it("should parse ffmpeg progress from key-value format", () => {
      const progressData = `
frame=300
fps=29.5
total_size=2097152
out_time_us=10500000
speed=1.1x
progress=continue
      `;

      const progress = parseProgressKeyValue(progressData);

      expect(progress).toEqual({
        time: 10, // 10.5 seconds floored to 10
        frame: 300,
        fps: 29.5,
        size: 2048, // 2097152 bytes = 2048 KB
        speed: 1.1,
        timeFormatted: "00:00:10",
      });
    });

    it("should handle partial key-value data", () => {
      const progressData = `
frame=150
out_time_us=5000000
speed= 2.0x
      `;

      const progress = parseProgressKeyValue(progressData);

      expect(progress).toEqual({
        time: 5,
        frame: 150,
        fps: 0,
        size: 0,
        speed: 2.0,
        timeFormatted: "00:00:05",
      });
    });

    it("should return empty object when no valid data found", () => {
      const progressData = "Some random ffmpeg output without key=value pairs";
      const progress = parseProgressKeyValue(progressData);
      expect(progress).toEqual({});
    });

    it("should handle longer duration formatting", () => {
      const progressData = `
frame=7200
out_time_us=3661000000
speed= 1.5x
      `;

      const progress = parseProgressKeyValue(progressData);

      expect(progress).toEqual({
        time: 3661,
        frame: 7200,
        fps: 0,
        size: 0,
        speed: 1.5,
        timeFormatted: "01:01:01", // 1 hour, 1 minute, 1 second
      });
    });
  });

  describe("displayProgress", () => {
    it("should display progress without duration", () => {
      const progress = {
        time: 125,
        frame: 300,
        fps: 29.5,
        size: 2048,
        speed: 1.1,
        timeFormatted: "00:02:05",
      };

      displayProgress(progress, null);

      expect(mockOutput).toContain("⏱️  00:02:05");
      expect(mockOutput).toContain("29.5fps");
      expect(mockOutput).toContain("1.1x");
      expect(mockOutput).toContain("2.0MB");
    });

    it("should display progress with duration and percentage", () => {
      const progress = {
        time: 60,
        frame: 300,
        fps: 30,
        size: 1024,
        speed: 1.0,
        timeFormatted: "00:01:00",
      };
      const duration = 120; // 2 minutes

      displayProgress(progress, duration);

      expect(mockOutput).toContain("⏱️  00:01:00");
      expect(mockOutput).toContain("50.0%"); // 60/120 * 100
      expect(mockOutput).toContain("█"); // Progress bar should contain filled blocks
      expect(mockOutput).toContain("░"); // Progress bar should contain empty blocks
    });

    it("should handle small file sizes in kB", () => {
      const progress = {
        time: 5,
        frame: 150,
        fps: 30,
        size: 512, // Less than 1MB
        speed: 1.0,
        timeFormatted: "00:00:05",
      };

      displayProgress(progress, null);

      expect(mockOutput).toContain("512kB");
    });

    it("should not display anything when progress has no time or frame", () => {
      const progress = {}; // Empty progress object
      displayProgress(progress, 120);
      expect(mockOutput).toBe("");
    });

    it("should display frame-based progress when no time is available", () => {
      const progress = { frame: 100, fps: 30, speed: 1.5 };
      displayProgress(progress, 120);
      expect(mockOutput).toContain("🎬 Frame 100");
      expect(mockOutput).toContain("30.0fps");
      expect(mockOutput).toContain("1.5x");
    });
  });

  describe("clearProgress", () => {
    it("should clear the progress line", () => {
      clearProgress();
      expect(process.stdout.write).toHaveBeenCalled();
      expect(mockOutput).toContain("\r");
    });
  });

  describe("createProgressTracker", () => {
    it("should create a progress tracker with update, updateKeyValue, complete, and clear methods", () => {
      const tracker = createProgressTracker("/fake/video.mp4");

      expect(tracker).toHaveProperty("update");
      expect(tracker).toHaveProperty("updateKeyValue");
      expect(tracker).toHaveProperty("complete");
      expect(tracker).toHaveProperty("clear");
      expect(tracker).toHaveProperty("duration");
      expect(typeof tracker.update).toBe("function");
      expect(typeof tracker.updateKeyValue).toBe("function");
      expect(typeof tracker.complete).toBe("function");
      expect(typeof tracker.clear).toBe("function");
    });

    it("should show completion message when complete() is called", () => {
      const tracker = createProgressTracker("/fake/video.mp4");
      tracker.complete();

      expect(mockOutput).toContain("✅ Encoding completed successfully");
    });

    it("should handle key-value progress updates", () => {
      const tracker = createProgressTracker("/fake/video.mp4");
      const progressData = "frame=100\nout_time_us=5000000\nspeed= 2.0x\n";

      tracker.updateKeyValue(progressData);

      // Since we don't have a real duration, it should still display basic progress
      expect(mockOutput).toContain("⏱️  00:00:05");
    });
  });
});
