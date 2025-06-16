import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdir,
  readFileSync,
  readdir,
  readdirSync,
  rmdirSync,
  unlinkSync,
} from "fs";
import { basename, join, resolve } from "path";
import { zipPackage } from "./zip";
import { parse as parseJSONC } from "jsonc-parser";

export { zipPackage };

type PackageJSON = {
  name: string;
  version: string;
  scripts: {
    [key: string]: string;
  };
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
  main: string;
  license: string;
};

const versionOnly = (str: string) =>
  str.match(/[0-9]+\.[0-9]+\.[0-9]+/)?.shift() || "";

export const packageSync = () => {
  const basePath = "./"; // Modify this path if your package files are in a different directory
  const packageFiles = readdirSync(basePath).filter((file) =>
    file.match(/^package\..*\.json(c?)$/)
  );
  const pack = readFileSync(join(basePath, "package.json"), "utf-8");
  const packJson = JSON.parse(pack) as PackageJSON;

  const warnings: { [key: string]: string[] } = {};

  packageFiles.forEach((file) => {
    let content = readFileSync(join(basePath, file), "utf-8");
    const jsonData = file.endsWith(".jsonc")
      ? (content = parseJSONC(content))
      : JSON.parse(content);
    const jsonContent = jsonData as PackageJSON;
    const framework = file.split(".")[1];

    warnings[framework] = [];

    Object.keys(packJson.dependencies).forEach((dep) => {
      const version = packJson.dependencies[dep];
      const frameworkVersion = jsonContent.dependencies?.[dep];

      if (frameworkVersion && frameworkVersion !== version) {
        warnings[framework].push(
          `${framework}: ${dep} ${frameworkVersion} -> ${version}`
        );
      }
    });

    Object.keys(packJson.devDependencies).forEach((dep) => {
      const version = packJson.devDependencies[dep];
      const frameworkVersion = jsonContent.devDependencies?.[dep];

      if (frameworkVersion && frameworkVersion !== version) {
        warnings[framework].push(
          `${framework} (devDependencies): ${dep} ${frameworkVersion} -> ${version}`
        );
      }
    });
  });

  console.log("\nFramework Package JSON Comparisons");
  Object.keys(warnings).forEach((framework) => {
    console.log(
      `- ${framework.charAt(0).toUpperCase() + framework.slice(1)} Warnings`,
      warnings[framework]
    );
  });

  // Verify updated package.json versions
  console.log("\nVerify Repo Versions Updated");
  const pluginDir =
    readdirSync(basePath).find(
      (name) =>
        name.startsWith("vite-") &&
        name.endsWith("-plugin") &&
        lstatSync(join(basePath, name)).isDirectory()
    ) || "";
  const pluginPack = readFileSync(join(pluginDir, "package.json"), "utf-8");
  const pluginPackJson = JSON.parse(pluginPack) as PackageJSON;

  const createScriptDir =
    readdirSync(basePath).find(
      (name) =>
        name.startsWith("create-bolt-") &&
        lstatSync(join(basePath, name)).isDirectory()
    ) || "";
  const createScriptPack = readFileSync(
    join(createScriptDir, "package.json"),
    "utf-8"
  );
  const createScriptPackJson = JSON.parse(createScriptPack) as PackageJSON;

  const rootDir = basename(resolve("."));

  const pluginVersion = pluginPackJson.version;

  const rootVersion = packJson.version;
  const rootDepPlugin = packJson.devDependencies[pluginDir];
  const rootDepPluginMatches = versionOnly(rootDepPlugin) === pluginVersion;

  const createScriptVersion = createScriptPackJson.version;
  const createDepRoot = createScriptPackJson.dependencies[rootDir];
  const createDepRootMatches = versionOnly(createDepRoot) === rootVersion;

  console.log("- ", pluginDir, pluginVersion);

  console.log("- ", rootDir, rootVersion);
  console.log(
    `  - ${pluginDir} version: ${rootDepPlugin} ${
      rootDepPluginMatches ? "✅" : `❌ Update to ${pluginVersion}`
    }`
  );

  console.log("- ", createScriptDir, createScriptVersion);
  console.log(
    `  - ${rootDir} version: ${createDepRoot} ${
      createDepRootMatches ? "✅" : `❌ Update to ${rootVersion}`
    }`
  );
  // TODO Test
  console.log("\nChangelog Update Check");

  const changelogPath = join(basePath, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    console.warn("- CHANGELOG.md not found. Please create or update it. ❌");
  } else {
    const changelogContent = readFileSync(changelogPath, "utf-8");
    const changelogVersionExists = changelogContent.includes(
      `Version ${rootVersion}`
    );
    if (!changelogVersionExists) {
      console.warn(
        `- CHANGELOG.md does not contain Version ${rootVersion} ❌ Please add it.`
      );
    } else {
      console.log(`- CHANGELOG.md contains Version ${rootVersion} ✅`);
    }
  }
};

export const emptyFolder = (folder: string) => {
  if (!existsSync(folder)) return;
  readdirSync(folder).forEach((file) => {
    const curPath = folder + "/" + file;
    if (lstatSync(curPath).isDirectory()) {
      emptyFolder(curPath);
      rmdirSync(curPath);
    } else {
      unlinkSync(curPath);
    }
  });
};

export const copyFilesRecursively = (
  srcDir: string,
  destDir: string,
  callback: () => void
) => {
  readdir(srcDir, { withFileTypes: true }, (err, items) => {
    if (err) {
      console.error("Error reading source directory:", err);
      return;
    }
    items.forEach((item) => {
      const srcPath = join(srcDir, item.name);
      const destPath = join(destDir, item.name);
      if (item.isDirectory()) {
        // Create the directory in the destination and recurse
        mkdir(destPath, { recursive: true }, (err) => {
          if (err) {
            console.error(`Error creating directory ${destPath}:`, err);
          } else {
            copyFilesRecursively(srcPath, destPath, callback);
          }
        });
      } else if (item.isFile()) {
        if (destPath.endsWith("manifest.json") && existsSync(destPath)) {
          const srcText = readFileSync(srcPath, "utf-8");
          const dstText = readFileSync(destPath, "utf-8");
          if (srcText !== dstText) {
            console.log(`\nmanifest.json has changed. Hot Reload will break\n`);
          }
        }
        // Copy file to the destination directory
        copyFileSync(srcPath, destPath);
        // console.log(`Copied ${srcPath} to ${destPath}`);
      }
    });
    callback && callback();
  });
};
