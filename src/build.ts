import * as path from "path";
import * as fs from "fs";
import * as fg from "fast-glob";
import * as color from "picocolors";

import { execAsync, getPackageManager, posix } from "./utils";
import { spinner, note } from "@clack/prompts";

import { capitalize, isArray, replace } from "radash";

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

const allCommentsRegex = /\/\/ BOLT_.*_(START|END|ONLY|REPLACE).*(\n|\r\n)?/gm;

const getJSXRegex = (variable: string) =>
  new RegExp(
    `\\{\\/\\* BOLT_${variable}_START \\*\\/\\}([\\s\\S]*?)\\{\\/\\* BOLT_${variable}_END \\*\\/\\}.*`,
    "gm"
  );

const allJSXCommentsRegex =
  /\{\/\* BOLT_.*_(START|END|ONLY|REPLACE) \*\/\}.*(\n|\r\n)?/gm;

const getHTMLRegex = (variable: string) =>
  new RegExp(
    `<!-- BOLT_${variable}_START -->[\\s\\S]*?<!-- BOLT_${variable}_END -->.*`,
    "g"
  );

const allHTMLCommentsRegex =
  /<!-- BOLT_.*_(START|END|ONLY|REPLACE) -->.*(\n|\r\n)?/gm;
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
        const stringRegex = /(\".*\")|(\'.*\')/g;
        const oldStringMatches = match.match(stringRegex);
        if (oldStringMatches) {
          const oldString = oldStringMatches[0];
          const quotation = oldString[0];
          const newString = `${quotation}${value}${quotation}`;
          const newMatch = match.replace(oldString, newString);
          txt = txt.replace(match, newMatch);
        }
      });
    }
  });

  // cleanup all remaining bolt comments
  txt = txt.replace(allCommentsRegex, "");
  txt = txt.replace(allHTMLCommentsRegex, "");
  txt = txt.replace(allJSXCommentsRegex, "");
  if (ext === ".html") {
    txt = txt.replace("<!-- Uncomment to debug the desired template -->", "");
    // txt = txt.replace(multiBlankLineRegex, "\n");
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
  if (!args.folder) throw Error("Folder not provided");
  if (!args.framework) throw Error("Folder not provided");

  const fullPath = path.join(process.cwd(), args.folder);
  note(
    `Creating ${intro.prettyName} in ${color.green(color.bold(fullPath))}`,
    "Info"
  );

  const localStem = posix(
    path.join(__dirname, "..", `/node_modules/${base.module}/`)
  );
  const globalStem = posix(path.join(__dirname, `../../${base.module}`));
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
  console.log({
    fileIncludes,
    fileExcludes,
    keywordIncludes,
    keywordExcludes,
  });

  const files = await fg(
    [
      ...fileIncludes.map((i) => posix(path.join(stem, i))),
      ...fileExcludes.map((i) => `!` + posix(path.join(stem, i))),
    ],
    {
      onlyFiles: true,
      followSymbolicLinks: true,
    }
  );

  console.log({ files });

  for (const file of files) {
    const fileName = file.replace(stem, "");
    const dest = path.join(fullPath, fileName);
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    if (fs.statSync(file).isDirectory()) {
      fs.cpSync(file, dest, {
        recursive: true,
      });
      // todo might need recursion here instead of if/else for file/folder
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

      // TODO: Update replace feature for ID, Display Name, etc.

      // wite file if changed
      if (newTxt !== txt) {
        args.verbose &&
          console.log(`UPDATING CHANGED: ${color.green(color.bold(fileName))}`);
        fs.writeFileSync(dest, newTxt, "utf8");
      }
    }
  }

  //* Update Config

  //* rename package.json
  fs.renameSync(
    path.join(fullPath, `package.${args.framework}.json`),
    path.join(fullPath, "package.json")
  );

  //* update package.json
  const packageJson = path.join(fullPath, "package.json");
  const packageJsonData = JSON.parse(fs.readFileSync(packageJson, "utf8"));
  packageJsonData.name = args.id;
  fs.writeFileSync(
    packageJson,
    JSON.stringify(packageJsonData, null, 2),
    "utf8"
  );

  const pm = getPackageManager() || "npm";
  // * Dependencies
  if (args.installDeps) {
    const s = spinner();
    s.start("Installing dependencies...");
    await execAsync(`cd ${fullPath} && ${pm} install`);
    s.stop("Dependencies installed!");
  }

  const noteStr = Object.keys(args).map((key) => {
    const value = args[key];
    return `${key} ${value.toString()}`;
  });
  note(noteStr.join("\n"), "Inputs");

  let summary = [
    `${intro.prettyName} generated` + `: ${color.green(color.bold(fullPath))}`,
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
