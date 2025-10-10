#!/usr/bin/env node
const app = require("../app");

app().catch((e) => {
  console.error(e, e.stack);
  process.exit(1);
});
