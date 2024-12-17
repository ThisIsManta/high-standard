**High Standard** is a hassle-free opinionated JavaScript code linter powered by [ESLint](https://eslint.org/docs/user-guide/configuring/).

The tool automatically scans and generates ESLint configs suitable to your tool chains:
- Git (not linting whatever in `.gitignore`)
- Jasmine
- Jest
- jQuery
- Lodash
- Prettier
- React
- Testing Library
- TypeScript
- Vitest

## Command-line usage

```
npm exec high-standard [...path] [--options]
```

|Argument|Description|
|---|---|
|`path`|Specify one or more file/directory/glob paths to files to be linted. If none specified, the current working directory will be used.|
|`--warnings` or `-w`|Turn on rules with warning severity.|
|`--cache`|Speed up processing time by reading last cached results.|
|`--fix` or `-f`|Fix auto-fixable errors and warnings.|
|`--update-allowlist` or `-u`|Silence all present errors so the next run will not report these errors again. Meaning that, as long as the error count per-file per-rule is lower or the same, the process will not break.|
|`--no-type-checking`|Speed up processing time by disabling the rules that require type information services.|
|`--no-progress`|Print only linting results.|

## ESLint compatible usage

Importing `high-standard` package exposes its ESLint flat configs, therefore you can integrate this with your typical ESLint workflow.

For example,
1. Install `high-standard` package locally
	```
	npm install --save-dev high-standard
	```
2. Create _eslint.config.js_ file next to your _package.json_ containing
	```js
	module.exports = require('high-standard')
	// or if ESM
	import config from 'high-standard'
	export default config
	```
3. Install [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) for VS Code.
4. Expect to see linting results inside your VS Code.