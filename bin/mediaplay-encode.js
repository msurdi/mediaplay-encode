#!/usr/bin/env node
const app = require("../app");

app().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e, e.stack);
  process.exit(1);
});
