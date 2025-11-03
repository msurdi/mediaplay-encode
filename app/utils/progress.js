const { execSync } = require("child_process");
const logger = require("../services/logger");

// Parse ffmpeg progress from key-value format (from -progress option)
const parseProgressKeyValue = (progressData) => {
  const lines = progressData.split("\n");
  const progress = {
    time: 0,
    frame: 0,
    fps: 0,
    size: 0,
    speed: 0,
  };

  for (const line of lines) {
    if (line.includes("=")) {
      const [key, value] = line.split("=", 2);
      switch (key.trim()) {
        case "frame":
          progress.frame = parseInt(value, 10) || 0;
          break;
        case "fps":
          if (value !== "N/A") {
            progress.fps = parseFloat(value) || 0;
          }
          break;
        case "total_size": {
          // Size might be in bytes, convert to KB for consistency
          // Handle "N/A" values
          if (value !== "N/A") {
            const sizeValue = parseInt(value, 10) || 0;
            progress.size = Math.round(sizeValue / 1024);
          }
          break;
        }
        case "out_time_us": {
          // Time is in microseconds, convert to seconds
          // Handle "N/A" values
          if (value !== "N/A") {
            const microseconds = parseInt(value, 10) || 0;
            progress.time = Math.floor(microseconds / 1000000);
          }
          break;
        }
        case "speed": {
          // Speed format might be " 420x" (with leading space)
          // Handle "N/A" values
          if (value !== "N/A") {
            const speedValue =
              parseFloat(value.replace(/x\s*$/, "").trim()) || 0;
            progress.speed = speedValue;
          }
          break;
        }
      }
    }
  }

  // Format time for display if we have it
  if (progress.time > 0) {
    const hours = Math.floor(progress.time / 3600);
    const minutes = Math.floor((progress.time % 3600) / 60);
    const seconds = progress.time % 60;
    progress.timeFormatted = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  // Return progress object if we have valid frame data, even if time is 0
  // This allows showing "Frame X" type progress even early in encoding
  if (progress.frame === 0 && progress.time === 0) {
    return {};
  }

  return progress;
};

// Parse ffmpeg progress from stderr output (legacy method)
const parseProgress = (stderr) => {
  const lines = stderr.split("\n");
  let progress = {};

  // Process lines in reverse order to get the most recent progress information
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // Look for progress lines that contain time and either frame= or corrupted patterns like ame=
    // Handle both normal "frame=" and corrupted "{ame=" patterns
    if (
      line.includes("time=") &&
      (line.includes("frame=") || line.includes("ame="))
    ) {
      const timeMatch = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      // Handle both "frame=" and corrupted "{ame=" patterns
      const frameMatch = line.match(/(?:\{?ame=|frame=)\s*(\d+)/);
      const fpsMatch = line.match(/fps=\s*([0-9.]+)/);
      // Updated size regex to handle both "size=" and "Lsize=" with both "kB" and "KiB"
      const sizeMatch = line.match(/(?:L?size=\s*)(\d+)(?:KiB|kB)/i);
      const speedMatch = line.match(/speed=\s*([0-9.]+)x/);

      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseInt(timeMatch[3], 10);
        // Keep original behavior of truncating centiseconds for backward compatibility
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        progress = {
          time: totalSeconds,
          frame: frameMatch ? parseInt(frameMatch[1], 10) : 0,
          fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
          size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
          speed: speedMatch ? parseFloat(speedMatch[1]) : 0,
          timeFormatted: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
        };

        // Return immediately after finding the first (most recent) valid progress line
        break;
      }
    }
  }

  return progress;
};

// Get video duration using ffprobe
const getVideoDuration = (sourcePath) => {
  try {
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${sourcePath}"`,
      { encoding: "utf8" }
    );
    return parseFloat(output.trim());
  } catch (error) {
    logger.debug(`Failed to get duration for ${sourcePath}: ${error.message}`);
    return null;
  }
};

// Display progress in-place
const displayProgress = (progress, duration) => {
  // Show progress if we have either time or frame data
  if (!progress.time && !progress.frame) return;

  let progressText = "";

  if (progress.timeFormatted) {
    progressText = `⏱️  ${progress.timeFormatted}`;
  } else if (progress.frame > 0) {
    progressText = `🎬 Frame ${progress.frame}`;
  }

  if (duration && duration > 0 && progress.time > 0) {
    const percentage = Math.min(100, (progress.time / duration) * 100);
    const barLength = 30; // Shorter progress bar to fit better
    const filledLength = Math.floor((percentage / 100) * barLength);
    const progressBar =
      "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
    progressText += ` [${progressBar}] ${percentage.toFixed(1)}%`;
  }

  if (progress.fps > 0) {
    progressText += ` | ${progress.fps.toFixed(1)}fps`;
  }

  if (progress.speed > 0) {
    progressText += ` | ${progress.speed}x`;
  }

  if (progress.size > 0) {
    const sizeMB = progress.size / 1024;
    const sizeUnit =
      sizeMB >= 1 ? `${sizeMB.toFixed(1)}MB` : `${progress.size}kB`;
    progressText += ` | ${sizeUnit}`;
  }

  // Clear the line and write progress (ensure we don't exceed terminal width)
  const maxWidth = process.stdout.columns || 120;
  if (progressText.length > maxWidth - 1) {
    progressText = `${progressText.substring(0, maxWidth - 4)}...`;
  }

  process.stdout.write(`\r${" ".repeat(maxWidth)}\r`);
  process.stdout.write(progressText);

  // Force flush the output to ensure it's visible immediately
  if (process.stdout.flush) {
    process.stdout.flush();
  }
};

// Clear the progress line
const clearProgress = () => {
  const maxWidth = process.stdout.columns || 120;
  process.stdout.write(`\r${" ".repeat(maxWidth)}\r`);
};

// Create a progress tracker for ffmpeg encoding
const createProgressTracker = (sourcePath) => {
  const duration = getVideoDuration(sourcePath);
  let lastProgressUpdate = 0;
  let lastProgressTime = 0; // Track the last progress time to avoid duplicate displays

  logger.debug(
    `Progress tracker created for ${sourcePath}, duration: ${duration}`
  );

  return {
    duration,

    // Update progress from stderr chunk (legacy method)
    update(stderr) {
      const progress = parseProgress(stderr);
      if (progress.time && progress.time !== lastProgressTime) {
        const now = Date.now();
        // Reduce throttling from 100ms to 50ms for more responsive updates
        if (now - lastProgressUpdate > 50) {
          logger.debug(
            `Progress update: time=${progress.time}, frame=${progress.frame}, speed=${progress.speed}x`
          );
          displayProgress(progress, duration);
          lastProgressUpdate = now;
          lastProgressTime = progress.time;
        }
      } else if (progress.time) {
        // Log when we skip updates due to same time (for debugging)
        logger.debug(
          `Skipping duplicate progress update for time=${progress.time}`
        );
      }
    },

    // Update progress from key-value format (new method)
    updateKeyValue(progressData) {
      const progress = parseProgressKeyValue(progressData);
      // Show progress if we have either time or frame data
      if (
        (progress.time && progress.time !== lastProgressTime) ||
        (progress.frame && progress.frame > 0 && !progress.time)
      ) {
        const now = Date.now();
        // Reduce throttling from 100ms to 50ms for more responsive updates
        if (now - lastProgressUpdate > 50) {
          logger.debug(
            `Progress update (key-value): time=${progress.time}, frame=${progress.frame}, speed=${progress.speed}x`
          );
          displayProgress(progress, duration);
          lastProgressUpdate = now;
          if (progress.time) {
            lastProgressTime = progress.time;
          }
        }
      } else if (progress.time) {
        // Log when we skip updates due to same time (for debugging)
        logger.debug(
          `Skipping duplicate progress update for time=${progress.time}`
        );
      }
    },

    // Clear progress and show completion message
    complete() {
      clearProgress();
      console.log("✅ Encoding completed successfully");
    },

    // Clear progress (for errors)
    clear() {
      clearProgress();
    },
  };
};

module.exports = {
  parseProgress,
  parseProgressKeyValue,
  getVideoDuration,
  displayProgress,
  clearProgress,
  createProgressTracker,
};
