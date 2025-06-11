/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu

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


const secp256k1 = require('secp256k1/elliptic');
import * as varuint from "varuint-bitcoin";
import { coinmap, CoinType, ow_hexString, ScriptType } from "./interface";
import { PaymentBTC } from "./payment";
import { PaymentBCH } from "./payment_bch";
import { PaymentGRS } from "./payment_grs";
import { Transaction } from "./transaction";
import { TransactionGRS } from "./transaction_grs";
import ow from "ow";
import { sha256 } from "hash.js";
import { taprootConvert } from "./bip340";


export function getPayment(coin: CoinType): typeof PaymentBTC {
    switch (coin) {
        case CoinType.BITCOINCASH:
            return PaymentBCH;

        case CoinType.GROESTL:
            return PaymentGRS;

        default:
            return PaymentBTC;
    }
}

export function getCoinType(path: string): CoinType {
    const bip32 = path.match(/\d+/g)!;
    const cointype = parseInt(bip32[1], 10);

    for (let i = 0; i < coinmap.length; i++) {
        if (cointype === coinmap[i].coinType) return i;
    }

    throw Error(`ArgumentError: unsupport cointype of BIP32 path, got ${path}`);
}

export function getPurpose(script: ScriptType): number {
    switch (script) {
        case ScriptType.P2PKH: return 44;
        case ScriptType.P2SH_P2PKH: return 49;
        case ScriptType.P2SH_P2WPKH: return 49;
        case ScriptType.P2WPKH: return 84;
        case ScriptType.P2TR: return 86;
    }

    throw Error(`ArgumentError: unsupport ScriptType, got ${script}`);
}

export function getDefaultScript(path: string): ScriptType {
    const bip32 = path.match(/\d+/g)!;
    const purpose = parseInt(bip32[0], 10);
    const coin = bip32[1] ? getCoinType(path) : CoinType.BITCOIN;

    switch (purpose) {
        case 44: return ScriptType.P2PKH;
        case 49: return (coin !== CoinType.BITCOINCASH) ? ScriptType.P2SH_P2WPKH : ScriptType.P2SH_P2PKH;
        case 84: return ScriptType.P2WPKH;
        case 86: return ScriptType.P2TR;
    }

    throw Error(`ArgumentError: unsupport purpose of path, got "${purpose}" from ${path}`);
}

export function getSerializer(coin: CoinType): typeof Transaction {
    switch (coin) {
        case CoinType.GROESTL:
            return TransactionGRS;

        default:
            return Transaction;
    }
}

export function getInScriptSize(type: ScriptType): number {
    switch (type) {
        case ScriptType.P2PKH:
        case ScriptType.P2SH_P2PKH: return 107;

        case ScriptType.P2SH_P2WPKH: return 23;
    }

    return 0;
}

export function getWitnessSize(type: ScriptType, sighashType: number = Transaction.SIGHASH_DEFAULT): Array<number> {
    switch (type) {
        case ScriptType.P2SH_P2WPKH:
        case ScriptType.P2WPKH: return [72, 33];

        case ScriptType.P2TR: return (sighashType === Transaction.SIGHASH_DEFAULT) ? [64] : [65];
    }

    return [];
}

export function getOutScriptSize(type: ScriptType): number {
    switch (type) {
        case ScriptType.P2PKH: return 25;

        case ScriptType.P2SH_P2PKH:
        case ScriptType.P2SH_P2WPKH: return 23;

        case ScriptType.P2WPKH: return 22;

        case ScriptType.P2WSH:
        case ScriptType.P2TR: return 34;
    }

    return 0;
}

export function getDustThreshold(output: ScriptType, dustRelayFee: number): number {
    const spendable = 8 + varuint.encodingLength(1) + getOutScriptSize(output);
    const minTxIn = (getWitnessSize(output).length !== 0)
        ? 32 + 4 + 1 + 26 + 4
        : 32 + 4 + 1 + 107 + 4;

    return (spendable + minTxIn) * dustRelayFee;
}

export function sliceSize(size: number) {
    return varuint.encodingLength(size) + size;
}

export function vectorSize(sizes: Array<number>) {
    return varuint.encodingLength(sizes.length) +
        sizes.reduce((sum, size) => sum + sliceSize(size), 0);
}

export function witnessStackToScriptWitness(witness: Buffer[]) {
    let buffer = Buffer.allocUnsafe(0);

    const writeVarInt = (i: number) => {
        const currentLen = buffer.length;
        const varintLen = varuint.encodingLength(i);

        buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)]);
        varuint.encode(i, buffer, currentLen);
    }

    writeVarInt(witness.length);
    for (const w of witness) {
        writeVarInt(w.length);
        buffer = Buffer.concat([buffer, Buffer.from(w)]);
    }

    return buffer;
}

export function scriptWitnessToWitnessStack(buffer: Buffer) {
    let offset = 0;

    const readVarInt = () => {
        const vi = varuint.decode(buffer, offset);
        offset += varuint.decode.bytes;

        return vi;
    }

    const readVarSlice = () => {
        const n = readVarInt();
        offset += n;

        return buffer.slice(offset - n, offset);
    }

    const count = readVarInt();
    const vector: Buffer[] = [];
    for (let i = 0; i < count; i++) {
        vector.push(readVarSlice());
    }

    return vector;
}

export function getPublickey(data: string | Buffer) {
    ow(data, ow.any(ow_hexString, ow.buffer));

    const pk = (typeof data === "string") ? Buffer.from(data, "hex") : data;
    if (!secp256k1.publicKeyVerify(pk)) {
        throw Error(`ArgumentError: invalid secp256k1 publickey, got "${pk.toString("hex")}"`);
    }

    return pk;
}

export function toTweakedPublickey(data: string | Buffer): Buffer {
    const publickey = getPublickey(data);
    const XOnlyPubkey = publickey.slice(1, 33);
    const commitHash = taggedHash("TapTweak", XOnlyPubkey);

    return taprootConvert(XOnlyPubkey, commitHash);
}


const TAGS = [
    'BIP0340/challenge',
    'BIP0340/aux',
    'BIP0340/nonce',
    'TapLeaf',
    'TapBranch',
    'TapSighash',
    'TapTweak',
    'KeyAgg list',
    'KeyAgg coefficient',
] as const;

export type TaggedHashPrefix = typeof TAGS[number];

/** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */
const TAGGED_HASH_PREFIXES = Object.fromEntries(
    TAGS.map(tag => {
        const tagHash = _sha256(tag);
        return [tag, Buffer.concat([tagHash, tagHash])];
    }),
) as { [k in TaggedHashPrefix]: Buffer };

export function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer {
    const buf = Buffer.concat([TAGGED_HASH_PREFIXES[prefix], data]);
    return Buffer.from(sha256().update(buf).digest());
}

function _sha256(tag: string) {
    return Buffer.from(sha256().update(tag).digest());
}