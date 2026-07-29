const fs = require("fs/promises");
const path = require("path");
const terser = require("terser");

async function main() {
    const directory = path.resolve(process.argv[2] ?? "./lib");
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = entries
        .filter(entry => entry.isFile() && entry.name.endsWith(".js"))
        .map(entry => entry.name)
        .sort();

    for (const file of files) {
        const target = path.join(directory, file);
        const source = await fs.readFile(target, "utf8");
        const result = await terser.minify(source, {
            compress: true,
            ecma: 2017,
            mangle: false,
            toplevel: true,
        });

        if (!result.code) {
            throw new Error(`Terser produced no output for ${target}`);
        }

        await fs.writeFile(target, result.code);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
