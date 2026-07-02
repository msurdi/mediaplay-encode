import path from "node:path";

export const getFailedPathFromTargetPath = (targetPath: string): string => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  const shortenedTargetFileName = targetFileName.slice(0, 240);
  return path.join(targetDir, `${shortenedTargetFileName}.failed`);
};

export const getTargetPathFromSourcePath = (
  sourcePath: string,
  encodedSuffix: string,
): string => {
  const sourceDirectory = path.dirname(sourcePath);
  const sourceExtension = path.extname(sourcePath);
  const sourceName = path.basename(sourcePath, sourceExtension);
  const targetName = `${sourceName}${encodedSuffix}`;
  const shortenedTargetName = targetName.slice(0, 240);
  const targetPath = path.join(sourceDirectory, shortenedTargetName);
  return targetPath;
};

export const getWorkInProgressPathFromTargetPath = (
  targetPath: string,
): string => {
  const targetDir = path.dirname(targetPath);
  const targetFileName = path.basename(targetPath);
  const shortenedTargetFileName = targetFileName.slice(0, 240);
  return path.join(targetDir, `.${shortenedTargetFileName}.tmp`);
};
