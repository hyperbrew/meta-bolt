import * as color from "picocolors";
// import * as yargs from "yargs";

import { Command, Option } from "commander";

// import yargs from "yargs/yargs";
// import { hideBin } from "yargs/helpers";

import { ArgTemplateTypes } from "./types";

export async function parseArgs(
  argsTemplate: ArgTemplateTypes[]
): Promise<any> {
  const program = new Command();
  // program.enablePositionalOptions();

  program
    .name("my-app")
    .description("CLI for my app")
    .version("1.0.0")
    .argument("<folder>", "Name of the folder for the new Bolt UXP plugin");
  program.exitOverride();

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

  // let argv = yargs()
  //   .usage("Usage: $0 <appname> [options]")
  //   .positional("folder", {
  //     describe: "Name of the folder for the new Bolt UXP plugin",
  //     type: "string",
  //   });

  // for (const arg of argsTemplate) {
  //   if (arg.type === "folder" || arg.type === "string") {
  //     argv.option(arg.name, {
  //       describe: arg.describe,
  //       type: "string",
  //       alias: arg.alias,
  //     });
  //   } else if (arg.type === "boolean") {
  //     argv.option(arg.name, {
  //       describe: arg.describe,
  //       type: "boolean",
  //       alias: arg.alias,
  //     });
  //   } else if (arg.type === "select") {
  //     argv.option(arg.name, {
  //       describe: arg.describe,
  //       type: "string",
  //       choices: arg.options.map((opt) => opt.value),
  //       alias: arg.alias,
  //     });
  //   } else if (arg.type === "multiselect") {
  //     argv.option(arg.name, {
  //       describe: arg.describe,
  //       type: "array",
  //       choices: arg.options.map((opt) => opt.value),
  //       alias: arg.alias,
  //     });
  //   }
  // }
  // return argv.argv;
}

export function throwError(arg: string, message: string, value: string) {
  const label = color.bgRed(` error `);
  const _arg = color.yellow(arg);
  const valueLabel = color.bgYellow(` value `);
  throw new Error(
    `\n${label} ${_arg} ${message}\n${valueLabel} ${_arg} was '${value}'\n`
  );
}
