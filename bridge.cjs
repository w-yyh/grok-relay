#!/usr/bin/env node
require("./cli.cjs")
  .run()
  .catch((error) => {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 1;
  });
