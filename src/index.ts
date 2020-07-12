import express from "express";
import yargs = require("yargs");
import globToRegExp from "glob-to-regexp";
import chalk from "chalk";
import puppeteer, { Browser, Page, errors } from "puppeteer";
import "express";
import { getStories, assertStoryHasNoErrors, DEFAULT_BASE_URL } from "./lib";
const checknark = chalk.greenBright("✓");
const fail = chalk.red("x");

function getCliOptions() {
  // Parse command line options
  const {
    d: waitDuration,
    w: maxWorkers,
    b: bail,
    u: baseUrl,
    s: waitForSelector,
    t: timeout,
    e: exclude,
    o: only,
    serveDirectory,
    servePort,
  } = yargs
    .usage("Usage: $0 [options]")
    .alias("t", "timeout")
    .nargs("t", 1)
    .describe("t", "Timeout for page load or selector lookup")
    .alias("d", "waitDuration")
    .nargs("d", 1)
    .describe(
      "d",
      "The duration after the page load to look for runtime errors in miliseconds"
    )
    .alias("s", "waitForSelector")
    .nargs("s", 1)
    .describe("s", "Assert that a given selector is present in dom")
    .alias("w", "maxWorkers")
    .nargs("w", 1)
    .describe(
      "w",
      "Specifies the maximum number of workers the worker-pool will spawn for running tests"
    )
    .alias("u", "url")
    .nargs("u", 1)
    .describe(
      "u",
      "The base url of the storybook instance e.g. http://localhost:6009/"
    )
    .alias("b", "bail")
    .describe("b", "Stop on first error")
    .alias("e", "exclude")
    .array("e")
    .describe(
      "e",
      'Exclude a story e.g. -e "base-intro" or -e "demo-*". Can be used multiple times'
    )
    .alias("o", "only")
    .array("o")
    .describe(
      "o",
      'Run only the stories e.g. -o "base-intro" or -o "demo-*". Can be used multiple times'
    )
    .describe(
      "serveDirectory",
      "Serves the directory of a static storybook build"
    )
    .describe("servePort", "The port used for serveDirectory").argv as Partial<{
    d: string;
    w: string;
    b: boolean;
    u: string;
    s: string;
    t: string;
    e: string[];
    o: string[];
    serveDirectory: string;
    servePort: string;
  }>;

  const excludeRegularExpressions = (exclude || []).map((exclusion) =>
    globToRegExp(String(exclusion), { extended: true })
  );
  const onlyRegularExpressions = (only || []).map((inclusion) =>
    globToRegExp(String(inclusion), { extended: true })
  );

  const toNumer = (val: string | undefined) =>
    typeof val === "string" && val !== "" ? Number(val) : undefined;

  const cliOptions = {
    waitDuration: toNumer(waitDuration) || 200,
    maxWorkers: toNumer(maxWorkers) || 5,
    bail: !!bail,
    baseUrl,
    waitForSelector: waitForSelector || "#root *",
    timeout: toNumer(timeout) || 5000,
    excludeRegularExpressions,
    onlyRegularExpressions,
    serveDirectory,
    servePort: toNumer(servePort) || 6011,
  };

  if (serveDirectory && !baseUrl) {
    cliOptions.baseUrl = `http://localhost:${cliOptions.servePort}/`;
  }

  return {
    baseUrl: DEFAULT_BASE_URL,
    ...cliOptions,
  };
}

const cliOptions = getCliOptions();

async function main(pages: Page[]) {
  console.log("Launching " + require("../package.json").name);

  let tearDownServer = () => {};
  if (cliOptions.serveDirectory) {
    console.log(" starting server on port " + cliOptions.servePort);
    tearDownServer = await launchExpressServer(cliOptions.serveDirectory, cliOptions.servePort);
  }

  const storiesPromise = getStories(pages[0], cliOptions.baseUrl);
  // Output launch errors
  try {
    await storiesPromise;
  } catch (e) {
    console.log(chalk.red(e.message));
    process.exit(1);
  }
  const allStories = await storiesPromise;

  // exclude / include stories based on cli arguments
  const stories = allStories.filter(
    (story) =>
      !cliOptions.excludeRegularExpressions.some((regExp) =>
        regExp.test(story.id)
      ) &&
      (cliOptions.onlyRegularExpressions.length === 0 ||
        cliOptions.onlyRegularExpressions.some((regExp) =>
          regExp.test(story.id)
        ))
  );

  console.log(
    ` ${
      stories.length !== 0 ? chalk.greenBright(stories.length) : chalk.red(0)
    } ${stories.length === 1 ? "story" : "stories"} found.`
  );

  console.log(` starting up ${pages.length} workers`);
  const errors = await testStories(pages, stories);
  tearDownServer();
  
  if (errors) {
    console.log(
      chalk.red(
        `${errors} of ${stories.length} ${
          stories.length !== 1 ? "stories" : "story"
        } failed.`
      )
    );
    process.exit(1);
  } else {
    console.log(
      chalk.green(
        `${stories.length} ${
          stories.length !== 1 ? "stories" : "story"
        } succeeded.`
      )
    );
  }
}

async function testStories(
  pages: Page[],
  stories: {
    id: string;
    kind: string;
    name: string;
  }[]
) {
  const storyStack = [...stories];

  let errors = 0;
  async function takeNext(page: Page): Promise<void> {
    const story = storyStack.shift();
    const start = Date.now();
    if (!story) {
      return;
    }
    let testError: Error | undefined;
    try {
      await testStory(page, story);
    } catch (err) {
      testError = err;
    }
    if (testError) {
      errors++;
      console.log(` ${fail} ${story.kind} - ${story.name}`);
      console.log(
        `   ${chalk.underline.blue(
          cliOptions.baseUrl + "iframe.html?id=" + story.id
        )}`
      );
      console.log("   " + testError.toString());
      console.log("\n");
      if (cliOptions.bail) {
        process.exit(1);
      }
    } else {
      console.log(
        ` ${checknark} ${story.id} (${story.kind} - ${story.name}) in ${(
          Math.round(Date.now() - start) / 1000
        ).toFixed(3)}s`
      );
    }
    return takeNext(page);
  }

  // Execute in parallel:
  await Promise.all(pages.map((page) => takeNext(page)));

  return errors;
}

async function testStory(
  page: Page,
  { id, name }: { id: string; name: string }
) {
  await assertStoryHasNoErrors(
    page,
    id,
    cliOptions.baseUrl,
    cliOptions.timeout,
    cliOptions.waitDuration,
    cliOptions.waitForSelector
  );
}

function launchExpressServer(directory: string, port: number) {
  return new Promise<() => void>((resolve, reject) => {
    const app = express();
    app.use(express.static(directory));
    let server = app.listen(port, (error: any) => error ? reject(error) : resolve(() => server.close()));
  })
}

// Start
puppeteer.launch().then(async (browser) => {
  // Generate a tab per worker
  // Use min 1 worker and max 15 workers
  const pages = await Promise.all(
    Array(Math.min(Math.max(1, cliOptions.maxWorkers || 1), 15))
      .fill("")
      .map(() => browser.newPage())
  );
  try {
    await main(pages);
  } catch (e) {
    await browser.close();
    throw e;
  }
  await browser.close();
  process.exit();
});
