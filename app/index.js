const { program } = require("commander");
const packageJson = require("../package.json");
const encode = require("./core/encode");

const defaultPaths = [process.cwd()];

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
const defaultSuffix = ".enc";
const defaultExcludePattern = "\\.enc";

program
  .storeOptionsAsProperties(false)
  .version(packageJson.version)
  .arguments("[paths...]")
  .option("-w, --webm", "Use webm format", false)
  .option("--debug", "Enable debug output")
  .option(
    "--delete-source",
    "Permanently removes source file after encoding",
    false
  )
  .option("-p, --preview", "Encode only 10s, for previewing the result", false)
  .option(
    "-r, --reverse-order",
    "Prioritize encoding newer (by creation time) files",
    false
  )
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
    0
  )
  .option(
    "-d, --work-dir <dir>",
    "Temporary work directory for encoding process",
    ""
  )
  .parse(process.argv);

const scanPaths = program.args.length ? program.args : defaultPaths;

module.exports = async () => encode.run(scanPaths, program.opts());
