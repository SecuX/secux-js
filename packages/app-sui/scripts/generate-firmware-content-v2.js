"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const esbuild = require("esbuild");

const packageRoot = path.resolve(__dirname, "..");
const temporaryBundle = path.join(os.tmpdir(), `secux-sui-content-v2-${process.pid}.cjs`);

async function main() {
    await esbuild.build({
        entryPoints: [path.join(__dirname, "generate-firmware-content-v2.ts")],
        outfile: temporaryBundle,
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node18",
        banner: { js: "var process = { ...globalThis.process, env: { ...globalThis.process.env } };" },
    });
    const result = spawnSync(process.execPath, [temporaryBundle, packageRoot], {
        cwd: packageRoot,
        stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status ?? 1;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => fs.rmSync(temporaryBundle, { force: true }));
