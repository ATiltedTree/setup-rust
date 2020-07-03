import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { exec } from "@actions/exec";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";
import { promises as fs } from "fs";
import { homedir } from "os";
import * as path from "path";

const CACHE_PATH = [path.join(homedir(), ".rustup", "toolchains")];
const INSTALL_ARGS = ["--default-toolchain", "none", "-y"];

async function run(): Promise<void> {
  try {
    try {
      await io.which("rustup", true);
    } catch (error) {
      switch (process.platform) {
        case "darwin":
        case "linux":
          var rustupSh = await tc.downloadTool("https://sh.rustup.rs");
          await fs.chmod(rustupSh, 0o755);
          core.debug("Starting rustup install!");
          await exec(rustupSh, INSTALL_ARGS);
          break;
        case "win32":
          core.debug("Starting rustup install!");
          await exec(
            await tc.downloadTool("https://win.rustup.rs"),
            INSTALL_ARGS
          );
          break;
        default:
          break;
      }
      core.addPath(path.join(homedir(), ".cargo", "bin"));
    }
    let version = core.getInput("rust-version", { required: true });
    let components = core.getInput("components");
    let targets = core.getInput("targets");

    const cacheKey = `rustup-${process.platform}-${version}-${components.replace(" ", "-")}-${targets}`

    await cache.restoreCache(CACHE_PATH, cacheKey);

    let args = [
      "toolchain",
      "install",
      version,
      "--profile",
      "minimal",
      "--allow-downgrade"
    ];
    if (components) {
      components.split(" ").forEach(val => {
        args.push("--component");
        args.push(val);
      });
    }
    if (targets) {
      targets.split(" ").forEach(val => {
        args.push("--target");
        args.push(val);
      });
    }

    core.info(
      `Installing toolchain with components and targets: ${version} -- ${process.platform} -- ${components} -- ${targets}`
    );

    let code = await exec("rustup", args);
    if (code != 0) {
      throw `Failed installing toolchain exited with code: ${code}`;
    }

    core.info(`Setting the default toolchain: ${version}`);
    let default_code = await exec("rustup", ["default", version]);
    if (default_code != 0) {
      throw `Failed setting the default toolchain exited with code: ${default_code}`;
    }

    core.info(`::add-matcher::${path.join(__dirname, "..", "rustc.json")}`);

    core.debug(
      `Saving cache: ${cacheKey}`
    );
    try {
      await cache.saveCache(CACHE_PATH, cacheKey);
    } catch (error) {
      core.warning(`Failed to save cache. Probably already cached: ${error}`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
