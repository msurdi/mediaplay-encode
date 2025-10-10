const fluentFFmpeg = require("fluent-ffmpeg");
const { execSync } = require("child_process");
const logger = require("./logger");

// Check if ffmpeg is available in system PATH
const checkFFmpegAvailability = () => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    logger.debug("ffmpeg found in system PATH");
  } catch (error) {
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
  constructor(stdout, stderr) {
    super(`${stdout}\n${stderr}`);
  }
}

const asPromise = (command) =>
  new Promise((resolve, reject) => {
    command
      .on("start", (commandLine) => {
        logger.debug(`Running ffmpeg command ${commandLine}`);
      })
      .on("error", (_err, stdout, stderr) => {
        reject(new EncodingError(stdout, stderr));
      })
      .on("end", (stdout, stderr) => {
        logger.debug(stdout);
        logger.debug(stderr);
        resolve();
      });
  });

const withMp4Params = (command) => {
  command.format("mp4").audioCodec("aac");
  command.videoCodec("libsvtav1");

  command.addOutputOptions([
    "-crf 30",
    "-preset 6",
    "-b:a 128k",
    "-movflags +faststart",
    "-map 0",
  ]);
  return command;
};

const runFFmpeg = async (sourcePath, targetPath, { preview }) => {
  const getBaseCommand = () => {
    const command = fluentFFmpeg(sourcePath, { niceness: 20 }).videoFilter(
      "scale='min(1280,iw)':'-2'"
    );

    if (preview) {
      command.duration(10);
    }

    return command;
  };

  return asPromise(withMp4Params(getBaseCommand()).save(targetPath));
};

module.exports = { runFFmpeg, EncodingError };
