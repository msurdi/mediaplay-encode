const { execSync, spawn } = require("child_process");
const logger = require("./logger");

// Check if ffmpeg is available in system PATH
const checkFFmpegAvailability = () => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    logger.debug("ffmpeg found in system PATH");
  } catch {
    logger.error("ffmpeg is not installed or not available in system PATH");
    logger.error(
      "Error: ffmpeg is required but not found. Please install ffmpeg and ensure it's available in your system PATH."
    );
    process.exit(1);
  }
};

// Check if the source file is already using AV1 codec
const isAV1Encoded = (sourcePath) => {
  try {
    const output = execSync(
      `ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${sourcePath}"`,
      { encoding: "utf8" }
    );
    const codec = output.trim().toLowerCase();
    const isAV1 = codec === "av01" || codec === "av1";
    if (isAV1) {
      logger.debug(
        `Source file ${sourcePath} is already AV1 encoded (${codec})`
      );
    } else {
      logger.debug(
        `Source file ${sourcePath} codec: ${codec}, will encode to AV1`
      );
    }
    return isAV1;
  } catch (error) {
    logger.debug(
      `Failed to detect codec for ${sourcePath}, assuming not AV1: ${error.message}`
    );
    return false;
  }
};

// Check ffmpeg availability on module load
checkFFmpegAvailability();

class EncodingError extends Error {
  constructor(message, stdout = "", stderr = "") {
    super(message);
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

const buildFFmpegArgs = (sourcePath, targetPath, { preview }) => {
  const isSourceAV1 = isAV1Encoded(sourcePath);

  if (isSourceAV1) {
    // For AV1 files, just copy streams and apply faststart
    logger.debug(
      "Source is already AV1, using copy mode with faststart optimization"
    );
    const args = [
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
    return args;
  } else {
    // For non-AV1 files, do full encoding
    logger.debug("Source is not AV1, performing full encoding");
    const args = [
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
      "0:a:0",
      "-map",
      "0:v:0",
      targetPath,
    ];
    return args;
  }
};

const runFFmpegCommand = (args) => {
  return new Promise((resolve, reject) => {
    const command = spawn("ffmpeg", args);
    let stdout = "";
    let stderr = "";

    command.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    command.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    command.on("spawn", () => {
      logger.debug(`Running ffmpeg command: ffmpeg ${args.join(" ")}`);
    });

    command.on("error", (error) => {
      reject(
        new EncodingError(
          `Failed to start ffmpeg: ${error.message}`,
          stdout,
          stderr
        )
      );
    });

    command.on("close", (code) => {
      if (code === 0) {
        logger.debug(stdout);
        logger.debug(stderr);
        resolve();
      } else {
        reject(
          new EncodingError(`ffmpeg exited with code ${code}`, stdout, stderr)
        );
      }
    });
  });
};

const runFFmpeg = async (sourcePath, targetPath, { preview }) => {
  const args = buildFFmpegArgs(sourcePath, targetPath, { preview });
  return runFFmpegCommand(args);
};

module.exports = { runFFmpeg, EncodingError };
