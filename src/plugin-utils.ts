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
import { join } from "path";

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

export const packageSync = () => {
  const basePath = "./"; // Modify this path if your package files are in a different directory
  const packageFiles = readdirSync(basePath).filter((file) =>
    file.match(/^package\..*\.json$/)
  );
  const pack = readFileSync(join(basePath, "package.json"), "utf-8");
  const packJson = JSON.parse(pack) as PackageJSON;

  const warnings: { [key: string]: string[] } = {};

  packageFiles.forEach((file) => {
    const content = readFileSync(join(basePath, file), "utf-8");
    const jsonContent = JSON.parse(content) as PackageJSON;
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

  Object.keys(warnings).forEach((framework) => {
    console.log(
      `${framework.charAt(0).toUpperCase() + framework.slice(1)} Warnings`,
      warnings[framework]
    );
  });
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
