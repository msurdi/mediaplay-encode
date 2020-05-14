const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");

const findRoot = require("find-root");

const projectRoot = findRoot(__dirname);

const fixturesDirPath = path.join(projectRoot, "tests/fixtures");

const binPath = path.join(projectRoot, "bin", "mediaplay-encode.js");

const cli = (args, cwd = projectRoot) => {
  return new Promise((resolve) => {
    exec(`${binPath} ${args.join(" ")}`, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error && error.code ? error.code : 0,
        error,
        stdout,
        stderr,
      });
    });
  });
};

const absolutePath = (fileName) => path.resolve(fixturesDirPath, fileName);

const getFixtureFilesPaths = async () => {
  const fileNames = await fs.readdir(fixturesDirPath);
  return fileNames.map(absolutePath);
};

const cleanGeneratedFiles = async () => {
  const fileNames = await fs.readdir(fixturesDirPath);
  const filesToDelete = fileNames
    .filter((fileName) => fileName.includes(".enc"))
    .map(absolutePath);
  for (const fileToDelete of filesToDelete) {
    await fs.remove(fileToDelete);
  }
};

module.exports = {
  cli,
  fixturesDirPath,
  getFixtureFilesPaths,
  cleanGeneratedFiles,
};
