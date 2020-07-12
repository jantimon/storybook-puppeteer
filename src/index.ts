import yargs = require("yargs");
import globToRegExp from "glob-to-regexp";
import chalk from "chalk";
import puppeteer, { Browser, Page } from "puppeteer";
import { getStories, assertStoryHasNoErrors, DEFAULT_BASE_URL } from "./lib";
const checknark = chalk.greenBright("✓");
const fail = chalk.red("x");

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
} = {
  d: 200,
  w: 5,
  b: false,
  u: DEFAULT_BASE_URL,
  s: "#root *",
  t: 5000,
  e: [],
  o: [],
  ...yargs
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
    ).argv,
};

const excludeRegularExpressions = (exclude || []).map((exclusion) =>
  globToRegExp(String(exclusion), { extended: true })
);
const onlyRegularExpressions = (only || []).map((exclusion) =>
  globToRegExp(String(exclusion), { extended: true })
);

async function main(pages: Page[]) {
  console.log("Launching " + require("../package.json").name);
  const allStories = await getStories(pages[0], baseUrl);

  // exclude / include stories based on cli arguments
  const stories = allStories.filter(
    (story) =>
      !excludeRegularExpressions.some((regExp) => regExp.test(story.id)) &&
      (onlyRegularExpressions.length === 0 ||
        onlyRegularExpressions.some((regExp) => regExp.test(story.id)))
  );

  console.log(
    ` ${
      stories.length !== 0 ? chalk.greenBright(stories.length) : chalk.red(0)
    } ${stories.length === 1 ? "story" : "stories"} found.`
  );

  const errors = await testStories(pages, stories);

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
        `   ${chalk.underline.blue(baseUrl + "iframe.html?id=" + story.id)}`
      );
      console.log("   " + testError.toString());
      console.log("\n");
      if (bail) {
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
    baseUrl,
    timeout,
    waitDuration,
    waitForSelector
  );
}

// Start
puppeteer.launch().then(async (browser) => {
  // Generate a tab per worker
  // Use min 1 worker and max 15 workers
  const pages = await Promise.all(
    Array(Math.min(Math.max(1, maxWorkers), 15))
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
});
