import { exec } from "node:child_process";
import fs from "fs/promises";
import path from "node:path";
import { cwd } from "node:process";
import util from "node:util";

const appPath = path.join(cwd(), "/app");
const studioPath = path.join(cwd(), "/studio");

// remove typescript
const filesToRemove = ["tsconfig.*", "*.ts", "env.d.ts"];

const execPromise = util.promisify(exec);

async function removeTypeScript(folderPath) {
  console.log("Initiated TS removal for ", folderPath);

  try {
    // installs
    await execPromise("npm install && npm run remove-typescript", {
      cwd: folderPath,
    });

    // remove files
    await execPromise(
      `npx rimraf -g ${filesToRemove.join(
        " "
      )} && npx rimraf -g "!(node_modules)**/**/*.ts" && npm uninstall rimraf typescript @sanity/types @portabletext/types`,
      {
        cwd: folderPath,
      }
    );

    // remove scripts from package.json
    const packageJsonPath = path.resolve(folderPath, "package.json");
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    delete pkg.scripts["remove-typescript"];
    await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2));

    // recursively loop through src folder to find all astro file paths
    const astroFilePaths = [];

    async function scanFolderForAstroFiles(folder) {
      const files = await fs.readdir(path.resolve(folder), {
        withFileTypes: true,
      });

      for (const file of files) {
        if (file.isFile() && file.name.endsWith(".astro")) {
          astroFilePaths.push(path.resolve(folder, file.name));
          continue;
        }

        if (file.isDirectory()) {
          await scanFolderForAstroFiles(path.resolve(folder, file.name));
        }
      }
    }

    await scanFolderForAstroFiles(path.resolve(folderPath, "src"));

    for (const astroFilePath of astroFilePaths) {
      const file = await fs.readFile(astroFilePath, {
        encoding: "utf8",
      });

      // remove typescript interfaces and import type {} from './types'
      const newAstroFile = file
        .replace(/interface Props \{(.|\n)*?\}/g, "")
        .replace('import type { Post } from "../utils/sanity";', "")
        .replace(" as { slug: string }", "");

      fs.writeFile(astroFilePath, newAstroFile);
    }

    console.log("Finished");
  } catch (error) {
    console.log(error);
  }
}

await removeTypeScript(studioPath);
await removeTypeScript(appPath);
