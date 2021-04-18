# High Standard

This is a command-line interface tool for generating [ESLint](https://eslint.org/docs/user-guide/configuring/) configurations.

The philosophy behind this is that every repository has different conventions and requires special treatments.
- A general-purpose linting tool, such [Standard JS](https://standardjs.com/#i-disagree-with-rule-x-can-you-change-it), may not serves all the use cases we need.
- An explicit _eslintrc_ file, which does not incorporate [`extends` property](https://eslint.org/docs/user-guide/configuring/configuration-files#extending-configuration-files), is more readable and clearer to follow.

1. Install this globally via `npm install -g high-standard`
1. Run `high-standard` at your repository root.
1. Expect to have _.eslintrc.json_ file created alongside your _package.json_
1. Run `npm install` to update your local dependencies.

Please see [_index.js_](index.js) for how ESLint rules are being generated.
