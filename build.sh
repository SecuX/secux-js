#!/bin/sh

set -eu

DIR=$(pwd)
SRC=$(basename "$DIR").ts
BIN=../../node_modules/.bin
WEBPACK=$BIN/webpack
TSC=$BIN/tsc
MINIFY=../../scripts/minify-lib.js

ORIGINAL_SOURCE=
restore_source() {
    if [ -n "$ORIGINAL_SOURCE" ] && [ -f ./tmp.ts ]; then
        mv ./tmp.ts "$ORIGINAL_SOURCE"
    fi
}
trap restore_source EXIT HUP INT TERM

if [ -d ./lib ]; then
    rm -r ./lib
fi

case "$SRC" in
    app-*|transport-*)
        SRC=./src/$SRC
        ORIGINAL_SOURCE=$SRC
        mv "$SRC" ./tmp.ts
        sed '/^@staticImplements<IPlugin>()/d' ./tmp.ts > "$SRC"

        if [ -f ./webpack.config.js ]; then
            if [ -d ./dist ]; then
                rm -r ./dist
            fi
            "$WEBPACK"
            for iteration in 1 2; do
                for bundle in ./dist/*.js; do
                    sed -e 's/\([^0-9a-zA-Z_]\)self\([^0-9a-zA-Z]\)/\1this\2/g' "$bundle" > "$bundle.tmp"
                    mv "$bundle.tmp" "$bundle"
                done
            done
        fi

        "$TSC"
        restore_source
        ORIGINAL_SOURCE=
        ;;
    *)
        "$TSC"
        ;;
esac

node "$MINIFY" ./lib
