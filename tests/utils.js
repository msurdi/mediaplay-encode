const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");

const findRoot = require("find-root");

const projectRoot = findRoot(__dirname);

const fixtuesRoot = path.join(projectRoot, "tests/fixtures");

const binPath = path.join(projectRoot, "bin", "mediaplay-encode.js");

const fixturePath = (fileName) => path.resolve(fixtuesRoot, fileName);

const cli = (args, cwd = fixturePath(".")) =>
  new Promise((resolve) => {
    exec(`${binPath} ${args.join(" ")}`, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error && error.code ? error.code : 0,
        error,
        stdout,
        stderr,
      });
    });
  });

const cleanGeneratedFiles = async (fixtureDir = ".") => {
  const cleanTargetDir = fixturePath(fixtureDir);
  const fileNames = await fs.readdir(cleanTargetDir);
  const filesToDelete = fileNames
    .filter(
      (fileName) =>
        fileName.includes(".enc") ||
        fileName.includes(".tmp") ||
        fileName.includes(".failed")
    )
    .map((fileName) => path.join(fixtureDir, fileName))
    .map(fixturePath);

  for (const fileToDelete of filesToDelete) {
    await fs.remove(fileToDelete);
  }
};

module.exports = {
  cli,
  fixturePath,
  cleanGeneratedFiles,
};
