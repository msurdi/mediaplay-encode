import { exec } from "node:child_process";
import path from "node:path";
import fs from "fs-extra";
import findRoot from "find-root";

export type CliResult = {
  code: number | string;
  error: Error | null;
  stdout: string;
  stderr: string;
};

const projectRoot = findRoot(import.meta.dirname);

const fixtuesRoot = path.join(projectRoot, "tests/fixtures");

export const binPath = path.join(projectRoot, "bin", "mediaplay-encode.ts");

export const fixturePath = (fileName: string): string =>
  path.resolve(fixtuesRoot, fileName);

export const cli = (
  args: string[],
  cwd = fixturePath("."),
): Promise<CliResult> =>
  new Promise((resolve) => {
    exec(`${binPath} ${args.join(" ")}`, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error?.code ? error.code : 0,
        error,
        stdout,
        stderr,
      });
    });
  });

export const cleanGeneratedFiles = async (fixtureDir = "."): Promise<void> => {
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
