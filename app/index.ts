import { program } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { run, type EncodeOptions } from "./core/encode.ts";

const defaultPath = process.cwd();

const defaultExtensions = [
  "f4v",
  "mov",
  "flv",
  "swf",
  "rm",
  "avi",
  "mkv",
  "mp4",
  "m4v",
  "wmv",
  "mpeg",
  "asf",
  "divx",
  "mpg",
  "ts",
];
const defaultSuffix = ".enc1";
const defaultExcludePattern = "\\.enc1\\.";

program
  .storeOptionsAsProperties(false)
  .version(packageJson.version)
  .arguments("[path]")
  .option("--debug", "Enable debug output")
  .option(
    "--delete-source",
    "Permanently removes source file after encoding",
    false
  )
  .option("-p, --preview", "Encode only 10s, for previewing the result", false)
  .option(
    "-e, --extensions [extension...]",
    "Comma separated list of extensions to encode from",
    defaultExtensions.join(",")
  )
  .option(
    "-x, --exclude-pattern <excludePattern>",
    "Exclude files matching this regular expression",
    defaultExcludePattern
  )
  .option(
    "-s, --encoded-suffix <suffix>",
    "Add this suffix to the target file name",
    defaultSuffix
  )
  .option(
    "-l, --loop-interval <seconds>",
    "When no files are found loop every <seconds> instead of terminating",
    (value) => Number(value),
    0,
  )
  .option(
    "-d, --work-dir <dir>",
    "Temporary work directory for encoding process",
    ""
  )
  .option(
    "-o, --one",
    "Process only one file and terminate, instead of processing all files",
    false
  )
  .option(
    "-t, --timeout <timeout>",
    "Timeout for ffmpeg/ffprobe commands (e.g. '4h', '30m', '60s', '500ms')",
    ""
  )
  .option("-P, --no-progress", "Disable interactive encoding progress output")
  .parse(process.argv);

const scanPath = program.args.length ? (program.args[0] ?? defaultPath) : defaultPath;

const app = async (): Promise<void> => {
  const options = program.opts<EncodeOptions>();
  const filesEncoded = await run(scanPath, options);

  // If looping is disabled and no files were encoded, exit with status 1
  if (!options.loopInterval && filesEncoded === 0) {
    process.exit(1);
  }
};

export default app;
