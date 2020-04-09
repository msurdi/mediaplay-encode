const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegPath);

class EncodingError extends Error {
  constructor(stdout, stderr) {
    super(`${stdout}\n${stderr}`);
  }
}

const runFfmpeg = (sourcePath, targetPath, { preview }) =>
  new Promise((resolve, reject) => {
    const command = ffmpeg(sourcePath, { niceness: 20 })
      .format("mp4")
      .videoCodec("libx264")
      .videoFilter("scale='min(1280,iw)':'-2'")
      .audioCodec("aac")
      .addOutputOptions([
        "-movflags +faststart",
        "-max_muxing_queue_size 2048",
        // "-filter:v-filter:v \"scale='min(1280,iw)':-2'\"",
        "-maxrate 6M",
        "-crf 19",
      ])
      .on("error", (_err, stdout, stderr) =>
        reject(new EncodingError(stdout, stderr))
      )
      .on("end", resolve);

    if (preview) {
      command.duration(10);
    }

    command.save(targetPath);
  });

const encodeService = {
  // TODO: ensure source exists
  // TODO: ensure target does not exist
  encode: async (sourcePath, targetPath, { preview }) => {
    await runFfmpeg(sourcePath, targetPath, { preview });
  },
};

module.exports = encodeService;
