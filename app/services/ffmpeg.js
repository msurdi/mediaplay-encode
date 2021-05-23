const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const logger = require("./logger");

ffmpeg.setFfmpegPath(ffmpegPath);

class EncodingError extends Error {
  constructor(stdout, stderr) {
    super(`${stdout}\n${stderr}`);
  }
}

const runFFmpeg = (sourcePath, targetPath, { preview, webm }) =>
  new Promise((resolve, reject) => {
    const command = ffmpeg(sourcePath, { niceness: 20 })
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
      })
      .videoFilter("scale='min(1280,iw)':'-2'");

    if (preview) {
      command.duration(10);
    }

    if (webm) {
      command.format("webm");
      command.addOutputOptions([
        "-preset fast",
        "-movflags +faststart",
        "-crf 19",
        "-b:v 0",
      ]);
    } else {
      command.format("mp4").audioCodec("aac");
      command.videoCodec("libx264");

      command.addOutputOptions([
        "-preset fast",
        "-movflags +faststart",
        "-max_muxing_queue_size 2048",
        "-maxrate 6M",
        "-crf 19",
      ]);
    }

    command.save(targetPath);
  });

module.exports = { runFFmpeg, EncodingError };
