import { Browser, Page } from "puppeteer";

const sleep = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

export const DEFAULT_BASE_URL = "http://localhost:6009/";

declare var __STORYBOOK_STORY_STORE__: {
  getStoriesForManager(): {
    [key: string]: { id: string; kind: string; name: string };
  };
};

export async function getStories(
  page: Page,
  baseUrl = DEFAULT_BASE_URL
): Promise<{ id: string; kind: string; name: string }[]> {
  await page.goto(`${baseUrl}iframe.html`);
  // Wait for javascript execution (once storybook rendered)
  await waitForGlobaLVariable(page, "__STORYBOOK_STORY_STORE__");
  // Return stories
  return await page.evaluate(() => {
    const stories = __STORYBOOK_STORY_STORE__.getStoriesForManager();
    return Object.keys(stories).map((storyId) => {
      const { id, kind, name } = stories[storyId];
      return { id, kind, name };
    });
  });
}

export async function assertStoryHasNoErrors(
  page: Page,
  id: string,
  baseUrl = DEFAULT_BASE_URL,
  timeout = 5000,
  waitForDuration = 1000,
  waitForSelector?: string
) {
  const errors: Array<any> = [];
  const handleError = (err: any) => {
    errors.push(err);
  };
  page.on("pageerror", handleError);

  try {
    await page.goto(`${baseUrl}iframe.html?id=${id}`, { waitUntil: "load", timeout });
    await waitForGlobaLVariable(page, "__STORYBOOK_STORY_STORE__");
    await sleep(waitForDuration);
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, {
        timeout
      });
    }
  } catch (e) {
    page.off("pageerror", handleError);   
    if (errors.length) {
      throw errors[0];
    }
    throw e;
  }
  page.off("pageerror", handleError);
  if (errors.length) {
    throw errors[0];
  }
}

async function waitForGlobaLVariable(
  page: Page,
  name: string,
  timeout: number = 5000
) {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Global Variable "${name}" timed out`)),
      timeout
    );
    while (true) {
      if (await page.evaluate(`typeof ${name} !== 'undefined'`)) {
        clearTimeout(timer);
        resolve();
        return;
      }
      await sleep(100);
    }
  });
}
