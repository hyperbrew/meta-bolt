#!/usr/bin/env node

import * as color from "picocolors";
import {
  intro,
  multiselect,
  select,
  text,
  isCancel,
  cancel,
  confirm,
} from "@clack/prompts";
import { buildBolt } from "./build";

// import { parseArgs } from "./parse-args";

import type {
  IntroData,
  ArgOpt,
  ArgTemplateGeneric,
  ArgTemplateBoolean,
  ArgTemplateString,
  ArgTemplateSelect,
  ArgTemplateTypes,
  BaseInfo,
  BoltInitData,
  ResArgs,
} from "./types";

export type { BoltInitData, ArgOpt };

const handleCancel = (value: unknown) => {
  if (isCancel(value)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }
};

export const main = async (initData: BoltInitData) => {
  console.clear();
  // console.log({ base: initData.base });

  const { intro, base, argsTemplate } = initData;
  boltIntro(intro);

  // const cliArgs = await parseArgs(argsTemplate);
  let resArgs: ResArgs = {
    folder: "",
    framework: "",
  };
  for (const arg of argsTemplate) {
    // console.log(arg);
    // TODO handle CLI
    let res;
    if (arg.type === "folder" || arg.type === "string") {
      res = (await text({
        message: arg.message,
        initialValue: arg.initialValue,
        validate: arg.validator,
      })) as string;
      handleCancel(res);
    } else if (arg.type === "boolean") {
      res = (await confirm({
        message: arg.message,
        initialValue: arg.initialValue,
      })) as boolean;
      handleCancel(res);
    } else if (arg.type === "select") {
      res = (await select({
        message: arg.message,
        options: arg.options,
      })) as string;
      handleCancel(res);
    } else if (arg.type === "multiselect") {
      res = (await multiselect({
        message: arg.message,
        options: arg.options,
        required: arg.required,
      })) as string[];
      handleCancel(res);
    }
    if (res) {
      resArgs[arg.name] = res;
    }
  }
  await buildBolt(intro, initData, base, resArgs);
  return resArgs;
};

function boltIntro(args: IntroData) {
  const name = args.name ?? "create-bolt-uxp";
  const url = args.url ?? "https://hyperbrew.co";
  const byLine = args.byLine ?? "by Hyper Brew";
  console.log();
  const cbc = color.bgGreen(` ${name} `);
  const urlElement = color.underline(url);
  const bru = color.gray("│   ") + color.cyan(`${byLine} | ${urlElement}`);
  intro(`${cbc} \n${bru}`);
}

// if not using as a module, run immediately
// if (!process.env.BOLT_MODULEONLY) {
//   main({});
// }
