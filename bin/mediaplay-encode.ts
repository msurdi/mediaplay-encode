#!/usr/bin/env node
import app from "../app/index.ts";

app().catch((error: unknown) => {
  console.error(error, error instanceof Error ? error.stack : undefined);
  process.exit(1);
});
