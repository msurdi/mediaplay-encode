const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const logger = require("./logger");

ffmpeg.setFfmpegPath(ffmpegPath);

class EncodingError extends Error {
  constructor(stdout, stderr) {
    super(`${stdout}\n${stderr}`);
  }
}

const runFFmpeg = (sourcePath, targetPath, { preview, highQuality, h265 }) =>
  new Promise((resolve, reject) => {
    const command = ffmpeg(sourcePath, { niceness: 20 })
      .format("mp4")
      .audioCodec("aac")
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

    if (h265) {
      command.videoCodec("libx265");
    } else {
      command.videoCodec("libx264");
    }

    if (preview) {
      command.duration(10);
    }

    if (highQuality) {
      command
        .videoFilter("scale='min(5120,iw)':'-2'")
        .addOutputOptions([
          "-preset fast",
          "-movflags +faststart",
          "-max_muxing_queue_size 2048",
          "-maxrate 50M",
          "-bufsize 25M",
          "-pix_fmt yuv420p",
          "-crf 18",
        ]);
    } else {
      command
        .videoFilter("scale='min(1280,iw)':'-2'")
        .addOutputOptions([
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