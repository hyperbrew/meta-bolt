import path from "path";
import fs from "fs";
import fg from "fast-glob";
import color from "picocolors";

import { execAsync, getPackageManager, posix } from "./utils";
import { spinner, note } from "@clack/prompts";

import { isArray } from "radash";

import type { IntroData, BaseInfo, BoltInitData, ResArgs } from "./types";

const multiBlankLineRegex = /(\r?\n\s*){1,}/g;

const getJSRangeRegex = (variable: string) =>
  new RegExp(
    `\/\/ BOLT_${variable}_START[\\s\\S]*?\/\/ BOLT_${variable}_END.*(\n|\r\n)?`,
    "gm"
  );
const getJSOnlyRegex = (variable: string) =>
  new RegExp(`^.*\/\/ BOLT_${variable}_ONLY.*(\n|\r\n)?`, "gm");

const getJSReplaceRegex = (variable: string) =>
  new RegExp(`^.*\/\/ BOLT_${variable}_REPLACE.*(\n|\r\n)?`, "gm");

const allInlineCommentsRegex = /\/\/ BOLT_.*_(ONLY|REPLACE)/gm;
const allReturnCommentsRegex = /^.*\/\/ BOLT_.*_(START|END).*(\n|\r\n)?/gm;

const getJSXRegex = (variable: string) =>
  new RegExp(
    `\\{\\/\\* BOLT_${variable}_START \\*\\/\\}([\\s\\S]*?)\\{\\/\\* BOLT_${variable}_END \\*\\/\\}.*`,
    "gm"
  );

const allReturnJSXCommentsRegex =
  /^.*\{\/\* BOLT_.*_(START|END) \*\/\}.*(\n|\r\n)?/gm;
const allInlineJSXCommentsRegex = /\{\/\* BOLT_.*_(ONLY|REPLACE) \*\/\}/gm;

const getHTMLRegex = (variable: string) =>
  new RegExp(
    `<!-- BOLT_${variable}_START -->[\\s\\S]*?<!-- BOLT_${variable}_END -->.*`,
    "g"
  );

const allReturnHTMLCommentsRegex =
  /^.*<!-- BOLT_.*_(START|END).*-->.*(\n|\r\n)?/gm;
const allInlineHTMLCommentsRegex = /<!-- BOLT_.*_(ONLY|REPLACE).*-->/gm;

const htmlDisabledScriptTagRegexStart = /<!-- <script/g;
const htmlDisabledScriptTagRegexEnd = /<\/script> -->.*/g;

const replaceAll = (txt: string, variable: string, replace: string) => {
  const rangeRegexJS = getJSRangeRegex(variable);
  const onlyRegexJS = getJSOnlyRegex(variable);
  const rangeRegexHTML = getHTMLRegex(variable);
  const onlyRegexHTML = getHTMLRegex(variable);
  const rangeRegexJSX = getJSXRegex(variable);

  txt = txt
    .replace(rangeRegexJS, replace)
    .replace(onlyRegexJS, replace)
    .replace(rangeRegexHTML, replace)
    .replace(onlyRegexHTML, replace)
    .replace(rangeRegexJSX, replace);

  return txt;
};

const formatFile = async (
  txt: string,
  ext: string,
  keywordsIncludes: string[],
  keywordsExcludes: string[],
  args: ResArgs
) => {
  // remove excluded keywords
  keywordsExcludes.map((keyword) => {
    const upper = keyword.toUpperCase();
    txt = replaceAll(txt, upper, "");
  });

  // inject replace values
  Object.keys(args).map((key) => {
    const value = args[key];
    const upper = key.toUpperCase();
    const rangeReplaceJS = getJSReplaceRegex(upper);
    const matches = txt.match(rangeReplaceJS);
    if (matches) {
      matches.map((match) => {
        const stringRegex = /(["'])((?:\\\1|(?:(?!\1)).)*)(\1)/g;
        const oldStringMatches = match.match(stringRegex);
        if (oldStringMatches) {
          const i = oldStringMatches.length - 1;
          const oldString = oldStringMatches[i];
          const quotation = oldString[0];
          const newString = `${quotation}${value}${quotation}`;
          const newMatch = match.replace(oldString, newString);
          txt = txt.replace(match, newMatch);
        }
      });
    }
  });

  // cleanup all remaining bolt comments
  [
    allInlineCommentsRegex,
    allReturnCommentsRegex,
    allReturnJSXCommentsRegex,
    allInlineJSXCommentsRegex,
    allReturnHTMLCommentsRegex,
    allInlineHTMLCommentsRegex,
  ].map((regex) => {
    txt = txt.replace(regex, "");
  });

  if (ext === ".html") {
    // re-enable all disabled <script /> tags
    txt = txt
      .replace(htmlDisabledScriptTagRegexStart, "<script")
      .replace(htmlDisabledScriptTagRegexEnd, "</script>");
  }
  //   txt = await prettier.format(txt, {
  //     parser: "typescript",
  //   });
  return txt;
};

export const buildBolt = async (
  intro: IntroData,
  initData: BoltInitData,
  base: BaseInfo,
  args: ResArgs
) => {
  if (!args.folder || typeof args.folder !== "string")
    throw Error("Folder not provided");
  if (!args.framework || typeof args.folder !== "string")
    throw Error("Framework not provided");

  const fullPath = path.join(process.cwd(), args.folder);
  note(
    `Creating ${intro.prettyName} in ${color.green(color.bold(fullPath))}`,
    "Info"
  );

  const localStem = posix(
    path.join(base.createDirName, "..", `/node_modules/${base.module}/`)
  );
  const globalStem = posix(
    path.join(base.createDirName, `../../${base.module}`)
  );
  // console.log({
  //   createDirName: base.createDirName,
  //   localStem,
  //   globalStem,
  // });
  const stem = fs.existsSync(globalStem) ? globalStem : localStem;

  if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { recursive: true });
  fs.mkdirSync(fullPath, { recursive: true });

  let fileIncludes = [...base.globalIncludes];
  let fileExcludes = [...base.globalExcludes];
  let keywordIncludes: string[] = [];
  let keywordExcludes: string[] = [];

  initData.argsTemplate.map((argTmp) => {
    if (argTmp.type === "select" || argTmp.type === "multiselect") {
      argTmp.options.map((opt) => {
        const selected = args[argTmp.name];
        const current = opt.value.toLowerCase();
        if (
          (typeof selected === "string" && selected === current) ||
          (isArray(selected) && selected.includes(current))
        ) {
          fileIncludes = [...fileIncludes, ...opt.files];
          keywordIncludes = [...keywordIncludes, opt.value.toUpperCase()];
        } else {
          fileExcludes = [...fileExcludes, ...opt.files];
          keywordExcludes = [...keywordExcludes, opt.value.toUpperCase()];
        }
      });
    }
    if (argTmp.type === "boolean") {
      const argName = argTmp.name;
      const argNameUpper = argName.toUpperCase();
      const value = args[argName];
      if (value) {
        keywordIncludes = [...keywordIncludes, argNameUpper];
      } else {
        keywordExcludes = [...keywordExcludes, argNameUpper];
      }
      if (argTmp.options) {
        const trueOpt = argTmp.options.find((o) => o.value === "true");
        const fasleOpt = argTmp.options.find((o) => o.value === "false");
        if (trueOpt && fasleOpt) {
          if (value) {
            fileIncludes = [...fileIncludes, ...trueOpt.files];
            fileExcludes = [...fileExcludes, ...fasleOpt.files];
          } else {
            fileIncludes = [...fileIncludes, ...fasleOpt.files];
            fileExcludes = [...fileExcludes, ...trueOpt.files];
          }
        }
      }
    }
  });
  // console.log({
  //   fileIncludes,
  //   fileExcludes,
  //   keywordIncludes,
  //   keywordExcludes,
  // });

  const files = await fg(
    [
      ...fileIncludes.map((i) => posix(path.join(stem, i))),
      ...fileExcludes.map((i) => `!` + posix(path.join(stem, i))),
    ],
    {
      onlyFiles: true,
      followSymbolicLinks: true,
      dot: true,
    }
  );

  // console.log({ files });

  for (const file of files) {
    const fileName = file.replace(stem, "");
    const dest = path.join(fullPath, fileName);
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    if (fs.statSync(file).isDirectory()) {
      fs.cpSync(file, dest, {
        recursive: true,
      });
    } else {
      fs.copyFileSync(file, dest);
      const txt = fs.readFileSync(dest, "utf8");
      const ext = path.extname(dest);

      const newTxt = await formatFile(
        txt,
        ext,
        keywordIncludes,
        keywordExcludes,
        args
      );

      // wite file if changed
      if (newTxt !== txt) {
        args.verbose &&
          console.log(`UPDATING CHANGED: ${color.green(color.bold(fileName))}`);
        fs.writeFileSync(dest, newTxt, "utf8");
      }
    }
  }

  //* Handle Renames
  initData.base.fileRenames?.map(([oldName, newName]) => {
    const oldPath = path.join(fullPath, oldName);
    if (!fs.existsSync(oldPath)) return;
    const newPath = path.join(fullPath, newName);
    fs.renameSync(oldPath, newPath);
  });

  const pm = getPackageManager() || "npm";
  // * Dependencies
  if (args.installDeps) {
    const s = spinner();
    s.start("Installing dependencies...");
    await execAsync(`cd "${fullPath}" && ${pm} install`);
    s.stop("Dependencies installed!");
  }

  const maxArgNameLength = Math.max(
    ...initData.argsTemplate.map((argTmp) => argTmp.name.length)
  );
  const noteStr = Object.keys(args).map((key) => {
    const value = args[key];
    return `${key.padEnd(maxArgNameLength + 3, " ")} ${value.toString()}`;
  });
  note(noteStr.join("\n"), "Inputs");

  let summary = [
    `${intro.prettyName} generated` + `: ${color.green(color.bold(fullPath))}.`,
    `To get started, run: ${color.yellow(
      `cd ${path.basename(fullPath)} && ${pm} run build`
    )} and see the README for more help.`,
  ];
  if (!args.installDeps) {
    summary = [
      ...summary,
      "",
      `Dependencies not installed. To install, run: ${color.yellow(
        `cd ${path.basename(fullPath)} && ${pm} install`
      )}`,
    ];
  }

  note(summary.join("\n"), "Summary");
  return fullPath;
};
