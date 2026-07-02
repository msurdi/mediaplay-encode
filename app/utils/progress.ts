import {
  execSync,
  type ExecSyncOptionsWithStringEncoding,
} from "node:child_process";
import logger from "../services/logger.ts";
import { formatTimeout } from "./timeout.ts";

export type Progress = Partial<{
  time: number;
  frame: number;
  fps: number;
  size: number;
  speed: number;
  timeFormatted: string;
}>;

type ProgressTracker = {
  duration: number | null;
  update: (stderr: string) => void;
  updateKeyValue: (progressData: string) => void;
  complete: () => void;
  clear: () => void;
};

type ProgressTrackerOptions = {
  timeoutMs?: number | null;
  enabled?: boolean;
};

const isErrorWithCode = (error: unknown): error is Error & { code: string } =>
  error instanceof Error && "code" in error && typeof error.code === "string";

export const parseProgressKeyValue = (progressData: string): Progress => {
  const lines = progressData.split("\n");
  const progress: Required<Omit<Progress, "timeFormatted">> & {
    timeFormatted?: string;
  } = {
    time: 0,
    frame: 0,
    fps: 0,
    size: 0,
    speed: 0,
  };

  for (const line of lines) {
    if (!line.includes("=")) continue;

    const [key, value] = line.split("=", 2);
    if (key === undefined || value === undefined) continue;

    switch (key.trim()) {
      case "frame":
        progress.frame = parseInt(value, 10) || 0;
        break;
      case "fps":
        if (value !== "N/A") {
          progress.fps = parseFloat(value) || 0;
        }
        break;
      case "total_size":
        if (value !== "N/A") {
          const sizeValue = parseInt(value, 10) || 0;
          progress.size = Math.round(sizeValue / 1024);
        }
        break;
      case "out_time_us":
        if (value !== "N/A") {
          const microseconds = parseInt(value, 10) || 0;
          progress.time = Math.floor(microseconds / 1000000);
        }
        break;
      case "speed":
        if (value !== "N/A") {
          const speedValue =
            parseFloat(value.replace(/x\s*$/, "").trim()) || 0;
          progress.speed = speedValue;
        }
        break;
    }
  }

  if (progress.time > 0) {
    const hours = Math.floor(progress.time / 3600);
    const minutes = Math.floor((progress.time % 3600) / 60);
    const seconds = progress.time % 60;
    progress.timeFormatted = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  if (progress.frame === 0 && progress.time === 0) {
    return {};
  }

  return progress;
};

export const parseProgress = (stderr: string): Progress => {
  const lines = stderr.split("\n");
  let progress: Progress = {};

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (
      line !== undefined &&
      line.includes("time=") &&
      (line.includes("frame=") || line.includes("ame="))
    ) {
      const timeMatch = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      const frameMatch = line.match(/(?:\{?ame=|frame=)\s*(\d+)/);
      const fpsMatch = line.match(/fps=\s*([0-9.]+)/);
      const sizeMatch = line.match(/(?:L?size=\s*)(\d+)(?:KiB|kB)/i);
      const speedMatch = line.match(/speed=\s*([0-9.]+)x/);

      if (timeMatch) {
        const [, hoursValue = "0", minutesValue = "0", secondsValue = "0"] =
          timeMatch;
        const hours = parseInt(hoursValue, 10);
        const minutes = parseInt(minutesValue, 10);
        const seconds = parseInt(secondsValue, 10);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        progress = {
          time: totalSeconds,
          frame: frameMatch ? parseInt(frameMatch[1] ?? "0", 10) : 0,
          fps: fpsMatch ? parseFloat(fpsMatch[1] ?? "0") : 0,
          size: sizeMatch ? parseInt(sizeMatch[1] ?? "0", 10) : 0,
          speed: speedMatch ? parseFloat(speedMatch[1] ?? "0") : 0,
          timeFormatted: `${hoursValue}:${minutesValue}:${secondsValue}`,
        };
        break;
      }
    }
  }

  return progress;
};

export const getVideoDuration = (
  sourcePath: string,
  timeoutMs: number | null = null,
): number | null => {
  try {
    const options: ExecSyncOptionsWithStringEncoding = { encoding: "utf8" };
    if (timeoutMs) {
      options.timeout = timeoutMs;
    }
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${sourcePath}"`,
      options,
    );
    return parseFloat(output.trim());
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "TIMEOUT") {
      logger.debug(
        `Duration detection for ${sourcePath} timed out after ${formatTimeout(timeoutMs)}`,
      );
    } else {
      logger.debug(
        `Failed to get duration for ${sourcePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return null;
  }
};

export const displayProgress = (
  progress: Progress,
  duration: number | null,
): void => {
  if (!progress.time && !progress.frame) return;

  let progressText = "";

  if (progress.timeFormatted) {
    progressText = `⏱️  ${progress.timeFormatted}`;
  } else if ((progress.frame ?? 0) > 0) {
    progressText = `🎬 Frame ${progress.frame}`;
  }

  if (duration && duration > 0 && (progress.time ?? 0) > 0) {
    const progressTime = progress.time ?? 0;
    const percentage = Math.min(100, (progressTime / duration) * 100);
    const barLength = 30;
    const filledLength = Math.floor((percentage / 100) * barLength);
    const progressBar =
      "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
    progressText += ` [${progressBar}] ${percentage.toFixed(1)}%`;
  }

  if ((progress.fps ?? 0) > 0) {
    progressText += ` | ${progress.fps?.toFixed(1)}fps`;
  }

  if ((progress.speed ?? 0) > 0) {
    progressText += ` | ${progress.speed}x`;
  }

  if ((progress.size ?? 0) > 0) {
    const progressSize = progress.size ?? 0;
    const sizeMB = progressSize / 1024;
    const sizeUnit =
      sizeMB >= 1 ? `${sizeMB.toFixed(1)}MB` : `${progressSize}kB`;
    progressText += ` | ${sizeUnit}`;
  }

  const maxWidth = process.stdout.columns || 120;
  if (progressText.length > maxWidth - 1) {
    progressText = `${progressText.substring(0, maxWidth - 4)}...`;
  }

  process.stdout.write(`\r${" ".repeat(maxWidth)}\r`);
  process.stdout.write(progressText);

  const flushableStdout = process.stdout as NodeJS.WriteStream & {
    flush?: () => void;
  };
  flushableStdout.flush?.();
};

export const clearProgress = (): void => {
  const maxWidth = process.stdout.columns || 120;
  process.stdout.write(`\r${" ".repeat(maxWidth)}\r`);
};

const createNoopProgressTracker = (): ProgressTracker => ({
  duration: null,
  update() {},
  updateKeyValue() {},
  complete() {},
  clear() {},
});

export const createProgressTracker = (
  sourcePath: string,
  options: ProgressTrackerOptions | number | null = {},
): ProgressTracker => {
  const normalizedOptions =
    typeof options === "number" || options === null
      ? { timeoutMs: options }
      : options;
  const { timeoutMs = null, enabled = true } = normalizedOptions;

  if (!enabled) {
    logger.debug(`Progress tracker disabled for ${sourcePath}`);
    return createNoopProgressTracker();
  }

  const duration = getVideoDuration(sourcePath, timeoutMs);
  let lastProgressUpdate = 0;
  let lastProgressTime = 0;

  logger.debug(
    `Progress tracker created for ${sourcePath}, duration: ${duration}`,
  );

  return {
    duration,

    update(stderr: string) {
      const progress = parseProgress(stderr);
      if (progress.time && progress.time !== lastProgressTime) {
        const now = Date.now();
        if (now - lastProgressUpdate > 50) {
          logger.debug(
            `Progress update: time=${progress.time}, frame=${progress.frame}, speed=${progress.speed}x`,
          );
          displayProgress(progress, duration);
          lastProgressUpdate = now;
          lastProgressTime = progress.time;
        }
      } else if (progress.time) {
        logger.debug(
          `Skipping duplicate progress update for time=${progress.time}`,
        );
      }
    },

    updateKeyValue(progressData: string) {
      const progress = parseProgressKeyValue(progressData);
      if (
        (progress.time && progress.time !== lastProgressTime) ||
        (progress.frame && progress.frame > 0 && !progress.time)
      ) {
        const now = Date.now();
        if (now - lastProgressUpdate > 50) {
          logger.debug(
            `Progress update (key-value): time=${progress.time}, frame=${progress.frame}, speed=${progress.speed}x`,
          );
          displayProgress(progress, duration);
          lastProgressUpdate = now;
          if (progress.time) {
            lastProgressTime = progress.time;
          }
        }
      } else if (progress.time) {
        logger.debug(
          `Skipping duplicate progress update for time=${progress.time}`,
        );
      }
    },

    complete() {
      clearProgress();
      console.log("✅ Encoding completed successfully");
    },

    clear() {
      clearProgress();
    },
  };
};
