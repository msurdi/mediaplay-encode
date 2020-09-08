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
];
const defaultSuffix = ".enc";
const defaultExcludePattern = "\\.enc";

program
  .storeOptionsAsProperties(false)
  .version(packageJson.version)
  .arguments("[paths...]")
  .option(
    "-5, --h265",
    "Use H.265 (less supported by browsers) instead of H.264",
    false
  )
  .option(
    "-i, --high-quality",
    "Sacrifice cpu and/or disk space to get better quality",
    false
  )
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
  .parse(process.argv);

const scanPaths = program.args.length ? program.args : defaultPaths;

module.exports = async () => encode.run(scanPaths, program.opts());
