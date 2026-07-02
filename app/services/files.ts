import fastGlob from "fast-glob";
import fs from "fs-extra";
import path from "node:path";

const isErrorWithCode = (error: unknown): error is Error & { code: string } =>
  error instanceof Error && "code" in error && typeof error.code === "string";

const findFirst = async (
  scanDir: string,
  predicate: (filePath: string) => Promise<boolean> | boolean,
): Promise<string | null> => {
  const stats = await fs.stat(scanDir);

  if (stats.isFile()) {
    const filePath = path.resolve(scanDir);
    return (await predicate(filePath)) ? filePath : null;
  }

  const stream = fastGlob.stream("**/*", {
    cwd: scanDir,
    onlyFiles: true,
    dot: false,
    absolute: true,
    followSymbolicLinks: false,
  });
  const destroyableStream = stream as typeof stream & { destroy: () => void };

  let found = null;
  try {
    for await (const file of stream) {
      const filePath = String(file);
      if (await predicate(filePath)) {
        found = filePath;
        // Stop the stream early
        destroyableStream.destroy();
        break;
      }
    }
  } catch (err) {
    // Ignore the expected ERR_STREAM_DESTROYED when we manually destroy
    if (!isErrorWithCode(err) || err.code !== "ERR_STREAM_DESTROYED") {
      throw err;
    }
  }

  return found;
};

const touch = async (filePath: string): Promise<void> =>
  fs.writeFile(filePath, "");

const filesService = {
  findFirst,
  touch,
};

export default filesService;
