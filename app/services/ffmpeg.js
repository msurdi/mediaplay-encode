const fluentFFmpeg = require("fluent-ffmpeg");
const tempfile = require("tempfile");
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
  command.videoCodec("libx264");

  command.addOutputOptions([
    "-preset fast",
    "-movflags +faststart",
    "-maxrate 6M",
    "-crf 17",
    "-map 0",
  ]);
  return command;
};

const commonWebmParams = [
  "-f webm",
  "-c:v libvpx-vp9",
  "-b:v 0",
  "-crf 28",
  "-movflags +faststart",
  `-passlogfile ${tempfile()}`,
];

const withWebMFirstPassParams = (command) => {
  command.addOutputOptions([...commonWebmParams, "-pass 1", "-f null"]);
  return command;
};

const withWebMSecondPassParams = (command) => {
  command.addOutputOptions([...commonWebmParams, "-pass 2", "-c:a libopus"]);
  return command;
};

const runFFmpeg = async (sourcePath, targetPath, { preview, webm }) => {
  const getBaseCommand = () => {
    const command = fluentFFmpeg(sourcePath, { niceness: 20 }).videoFilter(
      "scale='min(1280,iw)':'-2'"
    );

    if (preview) {
      command.duration(10);
    }

    return command;
  };

  if (webm) {
    await asPromise(
      withWebMFirstPassParams(getBaseCommand()).save("/dev/null")
    );
    return asPromise(
      withWebMSecondPassParams(getBaseCommand()).save(targetPath)
    );
  }
  return asPromise(withMp4Params(getBaseCommand()).save(targetPath));
};

module.exports = { runFFmpeg, EncodingError };
