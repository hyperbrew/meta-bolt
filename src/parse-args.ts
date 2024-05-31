import * as color from "picocolors";

import { Command, Option } from "commander";

import { ArgTemplateTypes, BoltInitData } from "./types";
import { clearLine } from "readline";

export async function parseArgs(initData: BoltInitData): Promise<any> {
  const { argsTemplate } = initData;
  const program = new Command();

  program
    .name(`create-${initData.intro.name || ""}`)
    .description(`CLI to create a new ${initData.intro.name}`)
    .version("1.0.0")
    .argument("<folder>", "Name of the folder for the new Bolt UXP plugin");
  program.exitOverride();
  program.configureOutput({
    // writeOut: (str) => {
    //   process.stdout.write(`${str}`);
    // },

    // don't log errors
    writeErr: (str) => {
      // process.stdout.write(`[ERR] ${str}`);
    },
    // Highlight errors in color.
    // outputError: (str, write) => {
    // write(errorColor(str));
    // },
  });

  for (const arg of argsTemplate) {
    let opt = new Option(`-${arg.alias} --${arg.name}`, arg.describe);
    opt.required = arg.required;

    if (arg.type === "string") {
      program.addOption(opt);
    } else if (arg.type === "boolean") {
      opt.argParser((val: string) => (val || val === "true" ? true : false));
      program.addOption(opt);
    } else if (arg.type === "select") {
      opt.choices(arg.options.map((opt) => opt.value));
      program.addOption(opt);
    } else if (arg.type === "multiselect") {
      opt.choices(arg.options.map((opt) => opt.value));
      opt.argParser((val: string) => val.split(","));
      program.addOption(opt);
    }
  }
  try {
    program.parse();
    const folder = program.args[0]; // Retrieve the positional argument
    const options = program.opts();
    return { ...options, folder }; // Return options including the positional argument
  } catch (e) {
    return {};
  }
}

export function throwError(arg: string, message: string, value: string) {
  const label = color.bgRed(` error `);
  const _arg = color.yellow(arg);
  const valueLabel = color.bgYellow(` value `);
  throw new Error(
    `\n${label} ${_arg} ${message}\n${valueLabel} ${_arg} was '${value}'\n`
  );
}
