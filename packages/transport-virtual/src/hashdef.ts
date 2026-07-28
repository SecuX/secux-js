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


import { Crypto } from "./crypto";
export { hashmap };

type hashFunc = (data: Uint8Array) => Uint8Array;
type hashdef = {
    cointype: Array<string>,
    hash: hashFunc,
    lowR?: boolean
};

export function taggedHash(data: Uint8Array, tag: string) {
    const tagHash = Crypto.sha256(Buffer.from(tag));
    return Crypto.sha256(Buffer.concat([tagHash, tagHash, data]));
}

const hashmap: { [cointype: string]: hashdef } = {};
function setmap(def: hashdef) {
    for (const c of def.cointype) {
        hashmap[c] = def;
    }
}

const bitcoin: hashdef = {
    cointype: ["0", "1"],
    hash: Crypto.hash256
};
setmap(bitcoin);

const bitcoincash: hashdef = {
    cointype: ["145"],
    hash: Crypto.hash256
};
setmap(bitcoincash);

const litecoin: hashdef = {
    cointype: ["2"],
    hash: Crypto.hash256
};
setmap(litecoin);

const dogecoin: hashdef = {
    cointype: ["3"],
    hash: Crypto.hash256
};
setmap(dogecoin);

const dashcoin: hashdef = {
    cointype: ["5"],
    hash: Crypto.hash256
};
setmap(dashcoin);

const digibyte: hashdef = {
    cointype: ["20"],
    hash: Crypto.hash256
};
setmap(digibyte);

const groestlcoin: hashdef = {
    cointype: ["17"],
    hash: Crypto.sha256
};
setmap(groestlcoin);

const ethereum: hashdef = {
    cointype: ["60"],
    hash: Crypto.keccak256
};
setmap(ethereum);

const binance: hashdef = {
    cointype: ["714"],
    hash: Crypto.sha256
};
setmap(binance);

const ripple: hashdef = {
    cointype: ["144"],
    hash: (data: Uint8Array) => Crypto.sha512(data).slice(0, 32)
};
setmap(ripple);

const cardano: hashdef = {
    cointype: ["1815"],
    hash: (data: Uint8Array) => Crypto.ed25519_ada.blake2b(data, 32)
};
setmap(cardano);

const solana: hashdef = {
    cointype: ["501"],
    hash: (data: Uint8Array) => data
};
setmap(solana);

const terra: hashdef = {
    cointype: ["330"],
    hash: Crypto.sha256
};
setmap(terra);

const fio: hashdef = {
    cointype: ["235"],
    hash: Crypto.sha256,
    lowR: true
};
setmap(fio);

const tron: hashdef = {
    cointype: ["195"],
    hash: Crypto.sha256
};
setmap(tron);

const stella: hashdef = {
    cointype: ["148"],
    hash: Crypto.sha256
};
setmap(stella);

const sui: hashdef = {
    cointype: ["784"],
    hash: Crypto.blake2b
};
setmap(sui);