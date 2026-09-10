"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const rootBin = path.join(repoRoot, "node_modules", ".bin");
const localBin = path.join(packageRoot, "node_modules", ".bin");
const webpack = path.join(rootBin, process.platform === "win32" ? "webpack.cmd" : "webpack");
const tsc = path.join(localBin, process.platform === "win32" ? "tsc.cmd" : "tsc");
const libPath = path.join(packageRoot, "lib");

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: packageRoot,
        stdio: "inherit",
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

if (!fs.existsSync(webpack)) {
    throw new Error(`Missing workspace webpack executable: ${webpack}`);
}

if (!fs.existsSync(tsc)) {
    throw new Error(
        `Missing app-sui TypeScript executable: ${tsc}. Run npm ci from the repository root.`
    );
}

fs.rmSync(libPath, { recursive: true, force: true });

run(webpack, ["--config", "webpack.config.js"]);
run(webpack, ["--config", "webpack.commonjs.config.js"]);
run(tsc, ["--project", "tsconfig.types.json"]);
run(process.execPath, ["scripts/verify-normal-bundles.js"]);
