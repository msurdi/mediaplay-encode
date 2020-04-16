const { program } = require("commander");
const packageJson = require("./package.json");
const logger = require("./services/logger");
const encodeDomain = require("./domain/encode");

const defaultPaths = [process.cwd()];

const defaultExtensions = [
  "f4v",
  "mov",
  "flv",
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
  .option("--debug", "Enable debug output")
  .option(
    "-d, --delete-source",
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

encodeDomain.run(scanPaths, program.opts()).catch((e) => {
  logger.error(e);
  process.exit(1);
});
