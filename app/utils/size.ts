import { filesize } from "filesize";
import fs from "fs-extra";

const size = async (filePath: string): Promise<string> => {
  const { size: statSize } = await fs.stat(filePath);
  return filesize(statSize);
};

export default size;
