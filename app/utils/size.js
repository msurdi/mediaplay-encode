const filesize = require("filesize");
const fs = require("fs-extra");

const size = async (filePath) => {
  const { size: statSize } = await fs.stat(filePath);
  return filesize(statSize);
};

module.exports = size;
