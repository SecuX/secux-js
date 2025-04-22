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


import { ITransport } from "@secux/transport";
import { decodePathBuffer, owTool, splitPath } from "@secux/utility";
import * as CMD from "@secux/protocol-transaction/lib/command";
import { EllipticCurve, ow_EllipticCurve } from "@secux/protocol-transaction/lib/interface";
import * as bip39 from "bip39";
import * as varuint from "varuint-bitcoin";
import { BIP32ED25519, HDKey, HDKeyED25519, IHDKey } from "./hdkey";
import { hashmap, taggedHash } from "./hashdef";
import ow from "ow";
import { communicationData, getBuffer, toCommunicationData } from "@secux/utility/lib/communication";
export { SecuxVirtualTransport };


class SecuxVirtualTransport extends ITransport {
    #seed: Buffer;
    #seed_ada: Buffer;


    constructor(mnemonic: string) {
        super({});

        this.#seed = bip39.mnemonicToSeedSync(mnemonic);
        this.#seed_ada = BIP32ED25519.generateSeed(mnemonic);
    }

    async Connect(): Promise<void> {}

    async Disconnect(): Promise<void> {}

    get Exchange() {
        return this.#Exchange;
    }

    async #Exchange(data: communicationData): Promise<any> {
        ow(data, ow.any(ow.buffer, owTool.base64String));


        data = getBuffer(data);
        const command = data.slice(0, 2);
        const len = data.readUInt16LE(4);
        const raw = data.slice(6, 6 + len);

        const reducer = (r: boolean, x: number, i: number) => r = r && (x === command[i]);
        if (CMD.GET_PUBLICKEY.reduce(reducer, true)) return this.#getPublickey(raw, data[2]);
        if (CMD.GET_XPUBLICKEY.reduce(reducer, true)) return this.#getXPublickey(raw, data[2]);
        if (CMD.SIGN_TX_RAW.reduce(reducer, true)) return this.#ParseAndSign(raw, data[3]);
        if (CMD.SIGN_MESSAGE.reduce(reducer, true)) {
            let offset = 1;
            const len = raw[offset++];
            const pathBuf = raw.slice(offset + 4, offset + len);
            const path = decodePathBuffer(pathBuf);
            const pathObj = splitPath(path);

            // ethereum sign message
            if (pathObj.purpose!.value === 44 && pathObj.coinType!.value === 60) {
                return this.#ParseAndSign(raw, data[3], true,
                    // txCount(1 byte) | length(1 byte) | path(24 bytes) | messageLength(2 bytes)
                    Buffer.from(`\x19Ethereum Signed Message:\n${raw.length - 28}`));
            }

            return this.#ParseAndSign(raw, data[3], true);
        }
        if (CMD.SIGN_TYPEDMESSAGE.reduce(reducer, true))
            return this.#ParseAndSign(raw, data[3], true,
                Buffer.from([
                    0x19,
                    0x01
                ]));
        if (CMD.SIGN_TX.reduce(reducer, true)) return this.#ParseAndSign(raw, data[3], false);


        throw Error("unsopported command");
    }

    #getPublickey(data: Buffer, curve: EllipticCurve): communicationData {
        ow(curve, ow_EllipticCurve);


        const path = decodePathBuffer(data);
        if (curve === EllipticCurve.SECP256K1) {
            const root = HDKey.fromMasterSeed(this.#seed, { compressed: false });
            const child = root.derive(path);

            // secp256k1 prefix will attached by SecuxTransactionTool (firmware behaviour)
            const pk = child.publicKey!.slice(1);
            return mimicResponse(pk);
        }

        if (curve === EllipticCurve.ED25519) {
            const root = HDKeyED25519.fromMasterSeed(this.#seed);
            const child = root.derive(path);

            return mimicResponse(child.publicKey!);
        }

        throw Error(`ArgumentError: unsupported curve, got "${EllipticCurve[curve]}"`);
    }

    #getXPublickey(data: Buffer, curve: EllipticCurve): communicationData {
        const path = decodePathBuffer(data);

        if (curve === EllipticCurve.ED25519_ADA) {
            const root = BIP32ED25519.fromMasterSeed(this.#seed_ada);
            const child = root.derive(path);

            return mimicResponse(Buffer.concat([child.publicKey!, child.chainCode!]));
        }

        const root = HDKey.fromMasterSeed(this.#seed, { compressed: false });
        const child = root.derive(path);

        const parentFingerPrint = Buffer.alloc(4);
        parentFingerPrint.writeUInt32BE(child.parentFingerprint!);

        const buf = Buffer.concat([
            child.publicKey!.slice(1),
            child.chainCode!,
            parentFingerPrint,
        ]);

        return mimicResponse(buf);
    }

    #ParseAndSign(data: Buffer, curve: EllipticCurve, doHash = true, prefix: Buffer = Buffer.alloc(0)) {
        let offset = 0;
        const txCount = data[offset++];

        const pathList: string[] = [];
        for (let i = 0; i < txCount; i++) {
            const len = data[offset++];
            const pathBuf = data.slice(offset + 4, offset + len);
            pathList.push(decodePathBuffer(pathBuf));

            offset += len;
        }

        const signatureList: Buffer[] = [];
        for (let i = 0; i < txCount; i++) {
            const len = data.readUInt16BE(offset);
            offset += 2;
            let buf = Buffer.concat([
                prefix,
                data.slice(offset, offset + len)
            ]);
            const sig = this.#sign(pathList[i], buf, curve, doHash);
            signatureList.push(sig);

            offset += len;
        }

        return mimicResponse(Buffer.concat(signatureList));
    }

    #sign(path: string, data: Buffer, curve: EllipticCurve, doHash = true): Buffer {
        ow(curve, ow_EllipticCurve);


        const parse = path.match(/\d+/g)!;
        let hash = (doHash) ? hashmap[parse[1]].hash : (x: Buffer) => x;

        if (!hash) throw Error(`ArgumentError: unsupported path for signing, got "${path}"`);

        let signCall = (parse[0] !== "86") ? "sign" : "signTweaked";
        if (doHash && [0, 1, 2, 3, 5, 17, 20, 145].find(x => x === parseInt(parse[1], 10)) !== undefined) {
            if (parse[0] === "44" && parse[1] !== "145") {
                data = parseBTC(data);
            }
            else if (parse[0] === "86") {
                hash = (data: Uint8Array) => taggedHash(data, "TapSighash");
                data = parseBTCWitnessV1(data);
            }
            else {
                data = parseBTCWitnessV0(data);
            }
        }

        let root: IHDKey;
        switch (curve) {
            case EllipticCurve.SECP256K1:
            case EllipticCurve.SECP256K1_LOW_R:
                root = HDKey.fromMasterSeed(this.#seed, hashmap[parse[1]]);
                break;

            case EllipticCurve.ED25519:
            case EllipticCurve.ED25519_RAW:
                root = HDKeyED25519.fromMasterSeed(this.#seed);
                break;

            case EllipticCurve.ED25519_ADA:
                root = BIP32ED25519.fromMasterSeed(this.#seed_ada);
                break;

            default:
                throw Error(`ArgumentError: unsupported curve, got "${EllipticCurve[curve]}"`);
        }

        const child = root.derive(path);
        // @ts-ignore
        const signature = child[signCall](hash(data));

        return signature;
    }
}


function mimicResponse(data: Buffer): communicationData {
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16LE(data.length);
    const statBuf = Buffer.alloc(2);
    statBuf.writeUInt16BE(0x9000);

    const response = Buffer.concat([
        lenBuf,
        data,
        statBuf,
        Buffer.alloc(2)
    ]);
    return toCommunicationData(response);
}

function parseBTC(buffer: Buffer): Buffer {
    let offset = 0;

    offset += 4; // version

    const marker = buffer.readUInt8(offset);
    offset += 1;
    const flag = buffer.readUInt8(offset);
    offset += 1;

    let hasWitnesses = false;
    if (marker === 0x00 && flag === 0x01) {
        hasWitnesses = true;
    } else {
        offset -= 2;
    }

    const vinLen = varuint.decode(buffer, offset);
    offset += varuint.decode.bytes;
    for (let i = 0; i < vinLen; i++) {
        offset += 36;
        offset += readSlice(buffer, offset);
        offset += 4;
    }

    const voutLen = varuint.decode(buffer, offset);
    offset += varuint.decode.bytes;
    for (let i = 0; i < voutLen; i++) {
        offset += 8;
        offset += readSlice(buffer, offset);
    }

    if (hasWitnesses) {
        for (let i = 0; i < vinLen; i++) {
            const n = varuint.decode(buffer, offset);
            offset += varuint.decode.bytes;

            for (let j = 0; j < n; j++) {
                offset += readSlice(buffer, offset);
            }
        }
    }

    offset += 4; // locktime
    offset += 4; // hashType

    return buffer.slice(0, offset);
}

function parseBTCWitnessV0(buffer: Buffer) {
    let offset = 0;

    offset += 4; // version
    offset += 32; // hashPrevouts
    offset += 32; // hashSequence
    offset += 32; // input hash
    offset += 4; // input index
    offset += readSlice(buffer, offset); // prevOutScript
    offset += 8; // value
    offset += 4; // sequence
    offset += 32; // hashOutputs
    offset += 4; // locktime
    offset += 4; // hashType

    return buffer.slice(0, offset);
}

const SIGHASH_DEFAULT = 0x00;
const SIGHASH_ALL = 0x01;
const SIGHASH_NONE = 0x02;
const SIGHASH_SINGLE = 0x03;
const SIGHASH_ANYONECANPAY = 0x80;
function parseBTCWitnessV1(buffer: Buffer) {
    let offset = 0;

    offset += 1; // sighash epoch

    const hashType = buffer.readUInt8(offset);
    offset += 1; // hashType

    offset += 4; // version
    offset += 4; // locktime

    const inputType = hashType & SIGHASH_ANYONECANPAY;
    const isAnyoneCanPay = inputType === SIGHASH_ANYONECANPAY;
    if (!isAnyoneCanPay) {
        offset += 32; // hashPrevouts
        offset += 32; // hashAmounts
        offset += 32; // hashScriptPubKeys
        offset += 32; // hashSequences
    }

    const outputType = (hashType === SIGHASH_DEFAULT) ? SIGHASH_ALL : hashType & SIGHASH_SINGLE;
    const isNone = outputType === SIGHASH_NONE;
    const isSingle = outputType === SIGHASH_SINGLE;
    if (!(isNone || isSingle)) offset += 32; // hashOutputs

    const spendType = buffer.readUInt8(offset);
    offset += 1; // spendType

    if (isAnyoneCanPay) {
        offset += 32; // hash
        offset += 4; // index
        offset += 8; // amount
        offset += readSlice(buffer, offset); // prevOutScripts
        offset += 4; // sequence
    }
    else {
        offset += 4; // input index
    }

    const annex = (spendType & 1) === 1;
    if (annex) offset += 32; // annex

    if (isSingle) offset += 32; // hashOutputs

    const leafHash = (spendType & 2) === 2;
    if (leafHash) {
        offset += 32; // leafHash
        offset += 1; // 0
        offset += 4; // 0xffffffff
    }

    return buffer.slice(0, offset);
}

function readSlice(buffer: Buffer, offset: number) {
    const len = varuint.decode(buffer, offset);
    return len + varuint.decode.bytes;
}