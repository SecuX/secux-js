#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const knownArgs = new Set(["--all", "--modules", "--system-tmp", "--dry-run", "--help"]);
const unknownArgs = [...args].filter((arg) => !knownArgs.has(arg));

if (args.has("--help")) {
    console.log(`Usage: node scripts/clean.js [options]

Options:
  --modules      Remove node_modules directories only
  --all          Remove build output, project temp files, and node_modules
  --system-tmp   Also remove project-owned directories from the OS temp directory
  --dry-run      Print what would be removed without deleting anything
  --help         Show this help`);
    process.exit(0);
}

if (unknownArgs.length > 0) {
    console.error(`Unknown option(s): ${unknownArgs.join(", ")}`);
    process.exit(1);
}

const modulesOnly = args.has("--modules") && !args.has("--all");
const includeModules = args.has("--modules") || args.has("--all");
const dryRun = args.has("--dry-run");
const buildDirectoryNames = new Set(["dist", "dist-debug", "lib", "build", ".tmp", "tmp"]);
const targets = [];

function isInside(parent, candidate) {
    const relative = path.relative(parent, candidate);
    return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);

        if (entry.name === ".git") continue;

        if (entry.name === "node_modules") {
            if (includeModules) targets.push(target);
            continue;
        }

        if (!modulesOnly && buildDirectoryNames.has(entry.name)) {
            targets.push(target);
            continue;
        }

        if (entry.isDirectory() && !entry.isSymbolicLink()) {
            collect(target);
        }
    }
}

collect(root);

if (args.has("--system-tmp")) {
    const tempRoot = path.resolve(os.tmpdir());
    const projectTempNames = new Set([path.basename(root), "secuxjs"]);

    for (const name of projectTempNames) {
        const target = path.join(tempRoot, name);
        if (isInside(tempRoot, target) && fs.existsSync(target)) targets.push(target);
    }
}

const uniqueTargets = [...new Set(targets.map((target) => path.resolve(target)))].sort();

if (uniqueTargets.length === 0) {
    console.log("Nothing to clean.");
    process.exit(0);
}

for (const target of uniqueTargets) {
    const inProject = isInside(root, target);
    const inSystemTemp = args.has("--system-tmp") && isInside(path.resolve(os.tmpdir()), target);

    if (!inProject && !inSystemTemp) {
        throw new Error(`Refusing to remove path outside approved roots: ${target}`);
    }

    console.log(`${dryRun ? "Would remove" : "Removing"} ${target}`);
    if (!dryRun) fs.rmSync(target, { recursive: true, force: true });
}

console.log(`${dryRun ? "Found" : "Removed"} ${uniqueTargets.length} director${uniqueTargets.length === 1 ? "y" : "ies"}.`);
