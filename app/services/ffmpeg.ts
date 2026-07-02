import {
  execSync,
  spawn,
  type ExecSyncOptions,
  type ExecSyncOptionsWithStringEncoding,
} from "node:child_process";
import logger from "./logger.ts";
import { createProgressTracker } from "../utils/progress.ts";
import { formatTimeout } from "../utils/timeout.ts";

type FFmpegOptions = {
  preview: boolean;
  timeoutMs?: number | null;
  progress?: boolean;
};

const isErrorWithCode = (error: unknown): error is Error & { code: string } =>
  error instanceof Error && "code" in error && typeof error.code === "string";

const checkFFmpegAvailability = (timeoutMs: number | null = null): void => {
  try {
    const options: ExecSyncOptions = { stdio: "ignore" };
    if (timeoutMs) {
      options.timeout = timeoutMs;
    }
    execSync("ffmpeg -version", options);
    logger.debug("ffmpeg found in system PATH");
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "TIMEOUT") {
      logger.error(
        `ffmpeg version check timed out after ${formatTimeout(timeoutMs)}`,
      );
    }
    logger.error("ffmpeg is not installed or not available in system PATH");
    logger.error(
      "Error: ffmpeg is required but not found. Please install ffmpeg and ensure it's available in your system PATH.",
    );
    process.exit(1);
  }
};

const isAV1Encoded = (
  sourcePath: string,
  timeoutMs: number | null = null,
): boolean => {
  try {
    const options: ExecSyncOptionsWithStringEncoding = { encoding: "utf8" };
    if (timeoutMs) {
      options.timeout = timeoutMs;
    }
    const output = execSync(
      `ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${sourcePath}"`,
      options,
    );
    const codec = output.trim().toLowerCase();
    const isAV1 = codec === "av01" || codec === "av1";
    if (isAV1) {
      logger.debug(
        `Source file ${sourcePath} is already AV1 encoded (${codec})`,
      );
    } else {
      logger.debug(
        `Source file ${sourcePath} codec: ${codec}, will encode to AV1`,
      );
    }
    return isAV1;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "TIMEOUT") {
      logger.debug(
        `Codec detection for ${sourcePath} timed out after ${formatTimeout(timeoutMs)}, assuming not AV1`,
      );
    } else {
      logger.debug(
        `Failed to detect codec for ${sourcePath}, assuming not AV1: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return false;
  }
};

checkFFmpegAvailability();

export class EncodingError extends Error {
  stdout: string;
  stderr: string;

  constructor(message: string, stdout = "", stderr = "") {
    super(message);
    this.name = "EncodingError";
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

const buildFFmpegArgs = (
  sourcePath: string,
  targetPath: string,
  { preview, timeoutMs = null, progress = true }: FFmpegOptions,
): string[] => {
  const isSourceAV1 = isAV1Encoded(sourcePath, timeoutMs);
  const progressArgs = progress ? ["-progress", "pipe:1"] : ["-nostats"];

  if (isSourceAV1) {
    logger.debug(
      "Source is already AV1, using copy mode with faststart optimization",
    );
    return [
      "-y",
      ...progressArgs,
      "-i",
      sourcePath,
      ...(preview ? ["-t", "10"] : []),
      "-f",
      "mp4",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "-map",
      "0:a:0",
      "-map",
      "0:v:0",
      targetPath,
    ];
  }

  return [
    "-y",
    ...progressArgs,
    "-i",
    sourcePath,
    ...(preview ? ["-t", "10"] : []),
    "-vf",
    "scale='min(1280,iw)':'-2'",
    "-f",
    "mp4",
    "-c:a",
    "aac",
    "-c:v",
    "libsvtav1",
    "-crf",
    "25",
    "-preset",
    "4",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-map",
    "0:a:0?",
    "-map",
    "0:v:0",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-fflags",
    "+discardcorrupt",
    "-err_detect",
    "ignore_err",
    targetPath,
  ];
};

const runFFmpegCommand = (
  args: string[],
  sourcePath: string,
  { timeoutMs = null, progress = true }: Omit<FFmpegOptions, "preview"> = {},
): Promise<void> =>
  new Promise((resolve, reject) => {
    const command = spawn("ffmpeg", args);
    let stdout = "";
    let stderr = "";
    let progressBuffer = "";
    const progressTracker = createProgressTracker(sourcePath, {
      timeoutMs,
      enabled: progress,
    });
    let timeoutHandle: NodeJS.Timeout | null = null;

    if (timeoutMs) {
      logger.debug(`Setting ffmpeg timeout to ${formatTimeout(timeoutMs)}`);
      timeoutHandle = setTimeout(() => {
        logger.warn(
          `ffmpeg command timed out after ${formatTimeout(timeoutMs)}, killing process`,
        );
        command.kill("SIGKILL");
        progressTracker.clear();
        reject(
          new EncodingError(
            `ffmpeg timed out after ${formatTimeout(timeoutMs)}`,
            stdout,
            stderr,
          ),
        );
      }, timeoutMs);
    }

    const clearTimeoutIfSet = (): void => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    command.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      progressBuffer += chunk;

      let progressMatch: RegExpMatchArray | null;
      while (
        (progressMatch = progressBuffer.match(
          /(.*?)progress=(continue|end)\n/s,
        ))
      ) {
        const progressBody = progressMatch[1] ?? "";
        const progressState = progressMatch[2] ?? "";
        const completeProgressBlock = `${progressBody}progress=${progressState}`;
        progressTracker.updateKeyValue(completeProgressBlock);
        progressBuffer = progressBuffer.substring(progressMatch[0].length);
      }
    });

    command.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
    });

    command.on("spawn", () => {
      const timeoutMsg = timeoutMs
        ? ` (timeout: ${formatTimeout(timeoutMs)})`
        : "";
      logger.debug(
        `Running ffmpeg command: ffmpeg ${args.join(" ")}${timeoutMsg}`,
      );
    });

    command.on("error", (error: Error) => {
      clearTimeoutIfSet();
      progressTracker.clear();
      reject(
        new EncodingError(
          `Failed to start ffmpeg: ${error.message}`,
          stdout,
          stderr,
        ),
      );
    });

    command.on("close", (code) => {
      clearTimeoutIfSet();
      if (code === 0) {
        progressTracker.complete();
        logger.debug("ffmpeg stdout:", stdout);
        logger.debug("ffmpeg stderr:", stderr);
        resolve();
      } else {
        progressTracker.clear();
        reject(
          new EncodingError(`ffmpeg exited with code ${code}`, stdout, stderr),
        );
      }
    });
  });

export const runFFmpeg = async (
  sourcePath: string,
  targetPath: string,
  { preview, timeoutMs = null, progress = true }: FFmpegOptions,
): Promise<void> => {
  const args = buildFFmpegArgs(sourcePath, targetPath, {
    preview,
    timeoutMs,
    progress,
  });
  return runFFmpegCommand(args, sourcePath, { timeoutMs, progress });
};
