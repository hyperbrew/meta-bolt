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
  log,
} from "@clack/prompts";
import { buildBolt } from "./build";

import { parseArgs } from "./parse-args";

import type { IntroData, ArgOpt, BoltInitData, ResArgs } from "./types";
import path from "path";
import { existsSync } from "fs";

export type { BoltInitData, ArgOpt };

const quitProcess = (value: string) => {
  cancel(value);
  return process.exit(0);
};

const handleCancel = (value: unknown) => {
  if (isCancel(value)) {
    return quitProcess("Operation cancelled");
  }
};

export const main = async (initData: BoltInitData) => {
  console.clear();
  // console.log({ base: initData.base });

  const { intro, base, argsTemplate } = initData;
  boltIntro(intro);

  const cliArgs: ResArgs = await parseArgs(initData);
  if (process.argv.pop() === "--help") {
    quitProcess("");
  }

  let promptArgs: ResArgs = {};
  for (const arg of argsTemplate) {
    if (typeof cliArgs[arg.name] !== "undefined") {
      continue;
    }

    let res;
    if (arg.type === "folder" || arg.type === "string") {
      let completed = false;
      while (!completed) {
        res = (await text({
          message: arg.message,
          initialValue: arg.initialValue,
          validate: arg.validator,
        })) as string;
        if (arg.type === "folder") {
          const fullPath = path.join(process.cwd(), res);
          if (existsSync(fullPath)) {
            const overwrite = (await confirm({
              message: `⚠️  WARNING: Folder already exists. Do you want to overwite it? ( ${fullPath} )`,
              initialValue: false,
            })) as boolean;
            if (!overwrite) continue;
          }
        }
        completed = true;
        handleCancel(res);
      }
    } else if (arg.type === "boolean") {
      res = (await confirm({
        message: arg.message,
        initialValue: arg.initialValue,
      })) as boolean;
      handleCancel(res);
    } else if (arg.type === "select") {
      let completed = false;
      while (!completed) {
        res = (await select({
          message: arg.message,
          options: arg.options,
        })) as string;
        if (arg.validator) {
          const err = arg.validator([res]);
          if (err) {
            log.warn(err);
            continue;
          }
        }
        completed = true;
        handleCancel(res);
      }
    } else if (arg.type === "multiselect") {
      let completed = false;
      while (!completed) {
        res = (await multiselect({
          message: arg.message,
          options: arg.options,
          required: arg.required,
        })) as string[];
        if (arg.validator) {
          const err = arg.validator(res);
          if (err) {
            log.warn(err);
            continue;
          }
        }
        completed = true;
        handleCancel(res);
      }
    }
    if (res) {
      promptArgs[arg.name] = res;
    }
  }

  const finalArgs: ResArgs = { ...cliArgs, ...promptArgs };
  // console.log({
  //   cliArgs,
  //   promptArgs,
  //   finalArgs,
  // });

  await buildBolt(intro, initData, base, finalArgs);
  return finalArgs;
};

function boltIntro(args: IntroData) {
  const name = args.name ?? "create-bolt";
  const url = args.url ?? "https://hyperbrew.co";
  const byLine = args.byLine ?? "by Hyper Brew";
  console.log();
  const cbc = color.bgGreen(` ${name} `);
  const urlElement = color.underline(url);
  const bru = color.gray("│   ") + color.cyan(`${byLine} | ${urlElement}`);
  intro(`${cbc} \n${bru}`);
}
