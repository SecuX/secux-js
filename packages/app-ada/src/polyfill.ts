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
