/*!
Copyright 2022 SecuX Technology Inc
Copyright Chang Chia-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const globalScope =
    (typeof globalThis !== 'undefined' ? globalThis :
        (typeof self !== 'undefined' ? self :
            (typeof window !== 'undefined' ? window :
                (typeof global !== 'undefined' ? global : this)))) as any;

if (typeof globalScope.self === 'undefined') {
    globalScope.self = globalScope;
}

if (typeof (Object as any).hasOwn === "undefined") {
    Object.defineProperty(Object, "hasOwn", {
        configurable: true,
        writable: true,
        value: function hasOwn(object: any, property: PropertyKey): boolean {
            if (object === null || object === undefined) {
                throw new TypeError("Cannot convert undefined or null to object");
            }
            return Object.prototype.hasOwnProperty.call(object, property);
        },
    });
}

if (typeof (Array.prototype as any).at === "undefined") {
    Object.defineProperty(Array.prototype, "at", {
        configurable: true,
        writable: true,
        value: function at(index: number): any {
            const length = this.length >>> 0;
            const integer = Math.trunc(Number(index)) || 0;
            const position = integer < 0 ? length + integer : integer;
            return position < 0 || position >= length ? undefined : this[position];
        },
    });
}

if (typeof globalScope.TextEncoder === "undefined") {
    class TextEncoder {
        encode(input?: string): Uint8Array {
            return Buffer.from(input || "", 'utf8');
        }
    }
    globalScope.TextEncoder = TextEncoder;
}

if (typeof globalScope.TextDecoder === "undefined") {
    class TextDecoder {
        decode(input?: Uint8Array): string {
            if (!input) return "";
            return Buffer.from(input).toString('utf8');
        }
    }
    globalScope.TextDecoder = TextDecoder;
}

if (typeof globalScope.atob === "undefined") {
    globalScope.atob = function (b64: string): string {
        return Buffer.from(b64, 'base64').toString('binary');
    };
}

if (typeof globalScope.btoa === "undefined") {
    globalScope.btoa = function (bin: string): string {
        return Buffer.from(bin, 'binary').toString('base64');
    };
}

if (typeof globalScope.structuredClone === "undefined") {
    globalScope.structuredClone = function structuredClone<T>(value: T): T {
        const seen = new Map<object, any>();

        const clone = (input: any): any => {
            if (input === null || typeof input !== "object") {
                if (typeof input === "function" || typeof input === "symbol") {
                    throw new TypeError("Value cannot be cloned");
                }
                return input;
            }

            const cached = seen.get(input);
            if (cached !== undefined) return cached;

            if (input instanceof Date) return new Date(input.getTime());
            if (input instanceof ArrayBuffer) return input.slice(0);
            if (ArrayBuffer.isView(input)) {
                if (input instanceof DataView) {
                    const buffer = input.buffer.slice(
                        input.byteOffset,
                        input.byteOffset + input.byteLength
                    );
                    return new DataView(buffer);
                }
                const TypedArray = input.constructor as {
                    new(value: ArrayBufferView): ArrayBufferView;
                };
                return new TypedArray(input);
            }

            if (input instanceof Map) {
                const output = new Map();
                seen.set(input, output);
                input.forEach((entryValue: any, entryKey: any) => {
                    output.set(clone(entryKey), clone(entryValue));
                });
                return output;
            }

            if (input instanceof Set) {
                const output = new Set();
                seen.set(input, output);
                input.forEach((entryValue: any) => output.add(clone(entryValue)));
                return output;
            }

            const output: any = Array.isArray(input) ? [] : {};
            seen.set(input, output);
            Object.keys(input).forEach(key => {
                output[key] = clone(input[key]);
            });
            return output;
        };

        return clone(value);
    };
}
