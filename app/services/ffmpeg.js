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
  const args = [
    "-i",
    sourcePath,
    "-vf",
    "scale='min(1280,iw)':'-2'",
    "-f",
    "mp4",
    "-c:a",
    "aac",
    "-c:v",
    "libsvtav1",
    "-crf",
    "30",
    "-preset",
    "6",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-map",
    "0",
  ];

  if (preview) {
    args.splice(2, 0, "-t", "10"); // Insert duration after input file
  }

  args.push(targetPath);
  return args;
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
