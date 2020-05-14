#!/usr/bin/env node
const app = require("../app");

app().catch((e) => {
  // eslint-disable-next-line no-console
  console.trace(e);
  process.exit(1);
});
