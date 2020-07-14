# Storybook Puppeteer

[![NPM version][npm-image]][npm-url]
[![License][license-image]][license-url]
[![Commitizen friendly][commitizen-image]][commitizen-url]

`storybook-puppeteer` is a CLI to run end-to-end tests for storybook stories.  

## Alternatives

[Jest](https://github.com/facebook/jest) gives you full control to test your components.  
If you are using a modern stack which allows using jest please concider using Jest directly or one of the following modules instead:

- [https://www.npmjs.com/package/@storybook/addon-storyshots](@storybook/addon-storyshots)
- [https://github.com/smooth-code/jest-puppeteer](jest-puppeteer)

## Getting started

`storybook-puppeteer` has 0 dependencies however it relies on puppeteer to be installed as a peer dependency.  
If puppeteer is not installed it will be installed during execution.

NPM 

```bash
npm i --save-dev storybook-puppeteer
npx storybook-puppeteer
```

```bash
yarn add --dev storybook-puppeteer
yarn storybook-puppeteer
```

![cli output demo](https://raw.githubusercontent.com/jantimon/storybook-puppeteer/master/storybook.png)


## Options

```
Options:
  --help                 Show help                                     [boolean]
  --version              Show version number                           [boolean]
  -t, --timeout          Timeout for page load or selector lookup
  -d, --waitDuration     The duration after the page load to look for runtime
                         errors in miliseconds
  -s, --waitForSelector  Assert that a given selector is present in dom
  -w, --maxWorkers       Specifies the maximum number of workers the worker-pool
                         will spawn for running tests
  -u, --url              The base url of the storybook instance e.g.
                         http://localhost:6009/
  -b, --bail             Stop on first error
  -e, --exclude          Exclude a story e.g. -e "base-intro" or -e "demo-*".
                         Can be used multiple times                      [array]
  -o, --only             Run only the stories e.g. -o "base-intro" or -o
                         "demo-*". Can be used multiple times            [array]
  --serveDirectory       Serves the directory of a static storybook build
  --servePort            The port used for serveDirectory
  --autoInstall          Install puppeteer if missing - true by default
```

## License

[MIT license](http://opensource.org/licenses/MIT)

[npm-image]: https://badge.fury.io/js/storybook-puppeteer.svg
[npm-url]: https://npmjs.org/package/storybook-puppeteer
[license-image]: https://img.shields.io/badge/license-MIT-green.svg
[license-url]: http://opensource.org/licenses/MIT
[commitizen-image]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/