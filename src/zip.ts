import fs from "fs";
import path from "path";
import archiver from "archiver";

import { log, resetLog } from "./lib";

const createZip = (src: string, dst: string, name: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip");
    const zipDest = path.join(dst, `${name}.zip`);
    const output = fs.createWriteStream(zipDest);
    output.on("close", () => {
      resolve(zipDest);
    });
    archive.on("error", (err) => {
      reject(err.message);
    });
    archive.pipe(output);
    archive.directory(src, false);
    archive.finalize();
  });
};

export const zipPackage = async (
  zipName: string,
  dest: string,
  src: string,
  assetDirs?: string[],
  srcSubFolder?: boolean
) => {
  fs.mkdirSync(dest, { recursive: true });
  const tmpDir = path.join(dest, "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpSrcDir = srcSubFolder ? path.join(tmpDir, zipName) : src;
  if (srcSubFolder) {
    fs.mkdirSync(tmpSrcDir, { recursive: true });
    console.log({ src, tmpSrcDir });
    fs.readdirSync(src).map((file) => {
      fs.cpSync(path.join(src, file), path.join(tmpSrcDir, file), {
        recursive: true,
      });
    });
  } else {
    fs.readdirSync(src).map((file) => {
      fs.cpSync(path.join(src, file), path.join(tmpDir, file), {
        recursive: true,
      });
    });
  }

  if (assetDirs) {
    assetDirs.map((assetDir) => {
      if (assetDir.endsWith("/*")) {
        const assetPath = path.join(assetDir.replace("/*", ""));
        fs.readdirSync(assetPath).map((file) => {
          fs.cpSync(path.join(assetPath, file), path.join(tmpDir, file), {
            recursive: true,
          });
        });
      } else {
        fs.cpSync(path.join(assetDir), path.join(tmpDir, assetDir), {
          recursive: true,
        });
      }
    });
  }

  const zip = await createZip(tmpDir, dest, zipName);
  log("built zip", true, zip);
  fs.rmSync(tmpDir, { recursive: true });
  resetLog();
  return zip;
};
