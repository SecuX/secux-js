/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu
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

import { blake2b } from '@noble/hashes/blake2';
import { sha256, sha512, ripemd160, hmac } from "hash.js";
import { keccak_256 } from "@noble/hashes/sha3";
import type { secp256k1 as ISECP256k1, schnorr } from "@noble/curves/secp256k1";
import type { ed25519 as IED25519 } from "@noble/curves/ed25519";
export { Crypto };


interface ISchnorr {
    signSchnorr: typeof schnorr.sign;
    verifySchnorr: typeof schnorr.verify;
}


class Crypto {
    static hmacSha256(secret: Uint8Array, message: Uint8Array): Uint8Array {
        //@ts-ignore
        const h = hmac(sha256, secret);
        return Uint8Array.from(h.update(message).digest());
    }

    static hmacSha512(secret: Uint8Array, message: Uint8Array): Uint8Array {
        //@ts-ignore
        const h = hmac(sha512, secret);
        return Uint8Array.from(h.update(message).digest());
    }

    static hash160(buf: Uint8Array): Uint8Array {
        const sha = Crypto.sha256(buf);
        return Crypto.ripemd160(sha);
    }

    static hash256(buf: Uint8Array): Uint8Array {
        const sha = Crypto.sha256(buf);
        return Crypto.sha256(sha);
    }

    static sha256(data: Uint8Array): Uint8Array {
        return Uint8Array.from(sha256().update(data).digest());
    }

    static sha512(data: Uint8Array): Uint8Array {
        return Uint8Array.from(sha512().update(data).digest());
    }

    static ripemd160(data: Uint8Array): Uint8Array {
        return Uint8Array.from(ripemd160().update(data).digest());
    }

    static keccak256(data: Uint8Array): Uint8Array {
        return keccak_256.create().update(data).digest();
    }

    static blake2b(data: Uint8Array): Uint8Array {
        return blake2b(data, { dkLen: 32 });
    }

    static get secp256k1(): typeof ISECP256k1 & ISchnorr {
        const { secp256k1, schnorr } = require("@noble/curves/secp256k1");
        const module = {
            ...secp256k1,
            signSchnorr: schnorr.sign,
            verifySchnorr: schnorr.verify
        };

        Object.defineProperty(Crypto, "secp256k1", {
            enumerable: false,
            configurable: false,
            writable: false,
            value: Object.freeze(module)
        });

        return module;
    }

    static get ed25519(): typeof IED25519 {
        const { ed25519 } = require("@noble/curves/ed25519");
        Object.defineProperty(Crypto, "ed25519", {
            enumerable: false,
            configurable: false,
            writable: false,
            value: Object.freeze(ed25519)
        });

        return ed25519;
    }

    static get ed25519_ada(): any {
        const cardano = require("cardano-crypto.js");
        Object.defineProperty(Crypto, "ed25519_ada", {
            enumerable: false,
            configurable: false,
            writable: false,
            value: Object.freeze(cardano)
        });

        return cardano;
    }
}
