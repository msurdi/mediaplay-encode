const ffmpegPath = require("ffmpeg-static");
const fluentFFmpeg = require("fluent-ffmpeg");
const logger = require("./logger");

fluentFFmpeg.setFfmpegPath(ffmpegPath);

class EncodingError extends Error {
  constructor(stdout, stderr) {
    super(`${stdout}\n${stderr}`);
  }
}

const withEventHandling = (command) =>
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
    "-max_muxing_queue_size 2048",
    "-maxrate 6M",
    "-crf 19",
  ]);
  return command;
};

const withWebMParams = (command) => {
  command.format("webm");
  command.addOutputOptions([
    "-preset fast",
    "-movflags +faststart",
    "-crf 19",
    "-b:v 0",
  ]);
  return command;
};

const runFFmpeg = (sourcePath, targetPath, { preview, webm }) => {
  const command = fluentFFmpeg(sourcePath, { niceness: 20 }).videoFilter(
    "scale='min(1280,iw)':'-2'"
  );

  if (preview) {
    command.duration(10);
  }

  if (webm) {
    withWebMParams(command).save(targetPath);
  } else {
    withMp4Params(command).save(targetPath);
  }

  return withEventHandling(command);
};

module.exports = { runFFmpeg, EncodingError };
