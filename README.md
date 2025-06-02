<img src="meta-bolt-logo.svg" alt="Meta Bolt" title="Meta Bolt" width="400" />

Meta Bolt by Hyper Brew is an underlying framework for many of Hyper Brew's popular frameworks like [Bolt Figma](https://github.com/hyperbrew/bolt-figma) [Bolt CEP](https://github.com/hyperbrew/bolt-cep/), [Bolt Express](https://github.com/hyperbrew/bolt-express/).

Coming soon:

- [Bolt UXP](https://github.com/hyperbrew/bolt-uxp/)

![npm](https://img.shields.io/npm/v/meta-bolt)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/hyperbrew/meta-bolt/blob/master/LICENSE)
[![Chat](https://img.shields.io/badge/chat-discord-7289da.svg)](https://discord.gg/PC3EvvuRbc)

Meta Bolt provides these frameworks with 2 things:

1.  A template for easily creating new `create-script` projects (e.g. `yarn create bolt-cep`)
2.  Helper functions for use in vite plugins (e.g. syncing npm packages, emptying folders, copying files, etc)

This package is mainly build for Hyper Brew's project, but it is open-source so feel free to use if you find it useful.

# How to build a new Bolt project with Meta Bolt

## 1. The Template

Firstly, you will need to construct a template that works for your desired project, ideally built on Vite.js, whether it's for a plugin template, addon framework, script setup, or something else.

Once you have your template working, add necessary files for various options (e.g. framework (svelte, react, vue))

## 2. The Plugin

Very connected to step 1, you will need to construct a custom Vite plugin for your project type (e.g. vite-cep-plugin, vite-figma-plugin, etc).

Utilize functions in meta-bolt's `plugin-utils` package to help with the plugin's functionality.

```js
import {
  packageSync,
  emptyFolder,
  copyFilesRecursively,
  zipPackage,
} from "meta-bolt/dist/plugin-utils";
```

## 3. The Create Script

Once your template and plugin are functioning well, now you'll need to construct a create script so a user can easily generate their own project from the specific Bolt project (e.g. `yarn create bolt-project`).

To do this, follow the template below to list all possible options for the user to choose from.

Only truly required options are:

- folder
- installDeps

```js
#!/usr/bin/env node

import { main } from "meta-bolt";
import type { BoltInitData, ArgOpt } from "meta-bolt";

export const frameworkOptions: ArgOpt[] = [
  {
    value: "svelte",
    label: "Svelte",
    files: ["src/index-svelte.ts", "src/main.svelte", "package.svelte.jsonc"],
  },
  {
    value: "react",
    label: "React",
    files: ["src/index-react.tsx", "src/main.tsx", "package.react.jsonc"],
  },
  {
    value: "vue",
    label: "Vue",
    files: ["src/index-vue.ts", "src/main.vue", "package.vue.jsonc"],
  },
];

export const otherOptions: ArgOpt[] = [
  {
    value: "a",
    label: "A",
    files: ["src/a.ts"],
  },
  {
    value: "b",
    label: "B",
    files: ["src/b.ts"],
  },
];

const initData: BoltInitData = {
  intro: {
    name: "create-bolt-project",
    prettyName: "Bolt Project",
  },
  base: {
    module: "bolt-project",
    globalIncludes: [
      "*",
      "src/**/*",
      "public/**/*",
      "public-zip/**/*",
      ".github/**/*",
      ".gitignore",
      ".env.example",
    ],
    globalExcludes: [".env", "yarn-error.log", "package.json"],
    fileRenames: [
      ["package.svelte.jsonc", "package.json"],
      ["package.react.jsonc", "package.json"],
      ["package.vue.jsonc", "package.json"],
    ],
  },
  argsTemplate: [
    {
      name: "folder",
      type: "folder",
      message: "Where do you want to create your project?",
      initialValue: "./",
      required: true,
      validator: (input: string) => {
        if (input.length < 3) return `Value is required!`;
      },
      describe: "Name of the folder for the new Bolt Project plugin",
    },
    {
      name: "displayName",
      type: "string",
      message: "Choose a unique Display Name for your plugin:",
      initialValue: "Bolt Project",
      required: true,
      validator: (input: string) => {
        if (input.length < 1) return `Value is required!`;
      },
      describe: "Panel's display name (e.g. Bolt Project)",
      alias: "n",
    },
    {
      name: "framework",
      type: "select",
      message: "Select framework:",
      alias: "f",
      describe: "Select a Framework for your plugin:",
      options: frameworkOptions,
      required: true,
    },
    {
      name: "other",
      type: "select",
      message: "Select other:",
      alias: "o",
      describe: "Select a Other for your plugin:",
      options: otherOptions,
      required: true,
    },
    {
      name: "installDeps",
      type: "boolean",
      message: "Install dependencies?",
      initialValue: true,
      required: true,
      alias: "d",
      describe: "Install dependencies (default: false)",
    },
    {
      name: "sampleCode",
      type: "boolean",
      message: "Keep Sample Code Snippets?",
      initialValue: true,
      required: true,
      alias: "s",
      describe: "Keep Sample Code (default: true)",
    },
  ],
};

//* if not using as a module, run immediately
if (!process.env.BOLT_MODULEONLY) main(initData);
```

Once you've built out your template with all the options for your project, now you will need to update your template to be dynamic with this create script.

You can accomplish this by:

### 1. Adding dynamic comments to various code sections:

Multi-Line options

```js
// BOLT_VARIABLE_START
someCode();
// BOLT_VARIABLE_END
```

Single Line options

```js
someCode(); // BOLT_VARIABLE_ONLY
```

### 2. Adding replace comments to various code sections:

Replace comments will grab the last string and replace it's contents with the parameter result

```jsonc
"name": "bolt-project", // BOLT_ID_REPLACE
```

```ts
const manifest: PluginManifest = {
  name: "Bolt Project", // BOLT_DISPLAYNAME_REPLACE
  id: "co.bolt.project", // BOLT_ID_REPLACE
  [...]
};
```

### 3. Adding files to various options

```ts
  {
    value: "react",
    label: "React",
    files: ["src/index-react.tsx", "src/main.tsx", "package.react.jsonc"],
  },
  {
    value: "vue",
    label: "Vue",
    files: ["src/index-vue.ts", "src/main.vue", "package.vue.jsonc"],
  },
```

### 4. Adding File Rename Instructions

```ts
  fileRenames: [
    ["package.svelte.jsonc", "package.json"],
    ["package.react.jsonc", "package.json"],
    ["package.vue.jsonc", "package.json"],
  ],
```
