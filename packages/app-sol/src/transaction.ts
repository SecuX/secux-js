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


import * as nacl from "tweetnacl";
import { Base58 } from "@secux/utility/lib/bs58";
import { Base58String, HexString } from "./interface";
import {
    AddressTableLookupData, addressTableLookupLayout, InstructionData, instructionLayout, MessageData,
    messageLayout, signDataLayout
} from "./layout";
import { toPublickey } from "./utils";


const PACKET_DATA_SIZE = 1280 - 40 - 8;
const PUBLICKEY_LENGTH = 32;
const SIGNATURE_LENGTH = 64;
const VERSION_PREFIX_MASK = 0x7f;

export type Instruction = {
    programId: HexString,
    accounts: Array<{ publickey: HexString, isSigner: boolean, isWritable: boolean }>,
    data: Buffer
};

export class Transaction {
    #recentBlockhash: Base58String;
    #numRequiredSignatures = 0;
    #numReadonlySignedAccounts = 0;
    #numReadonlyUnsignedAccounts = 0;
    #signedKeys: Array<HexString> = [];
    #readonlySignedKeys: Array<HexString> = [];
    #unsignedKeys: Array<HexString> = [];
    #readonlyUnsignedKeys: Array<HexString> = [];
    #instructions: Array<Instruction> = [];
    #sigMap: { [publickey: HexString]: Buffer } = {};
    #cache?: Buffer;

    constructor(blockHash: Base58String) {
        this.#recentBlockhash = blockHash;
    }

    static from(data: Buffer): Transaction {
        const byteArray = [...data];
        const signatureCount = decodeLength(byteArray);
        const signatures = byteArray.splice(0, signatureCount * SIGNATURE_LENGTH);

        const tx = Transaction.fromMessage(Buffer.from(byteArray));
        for (const publickey of tx.#signedKeys) {
            const signature = Buffer.from(signatures.splice(0, SIGNATURE_LENGTH));
            const isNull = signature.findIndex(n => n !== 0) < 0;

            if (!isNull) tx.#sigMap[publickey] = signature;
        }

        return tx;
    }

    static fromMessage(data: Buffer): Transaction {
        const prefix = data[0];
        const isLegacy = prefix === (prefix & VERSION_PREFIX_MASK);

        const tx = isLegacy ? new Transaction('') : new TransactionV0('');
        const byteArray = tx.deserializeMessage(data);
        tx.#cache = data.slice(0, data.length - byteArray.length);

        return tx;
    }

    addInstruction(ins: Instruction) {
        this.#instructions.push(ins);

        for (const account of ins.accounts) {
            const pk = account.publickey;

            if (account.isSigner) {
                if (account.isWritable) {
                    this.#signedKeys.push(pk);
                }
                else
                    this.#readonlySignedKeys.push(pk);
            }
            else {
                if (!account.isWritable)
                    this.#readonlyUnsignedKeys.push(pk);
                else
                    this.#unsignedKeys.push(pk);
            }
        }

        this.#readonlyUnsignedKeys.push(ins.programId);
    }

    dataForSign(feePayer?: HexString): Buffer {
        if (this.#cache) return this.#cache;

        this.#cache = this.serializeMessage(feePayer);
        return this.#cache;
    }

    addSignature(publickey: HexString, signature: Buffer) {
        if (!this.#cache) throw Error("message serialization needed");

        if (signature.length !== SIGNATURE_LENGTH) {
            throw Error(`invalid signature length, got ${signature.toString("hex")}`);
        }

        if (!this.#signedKeys.find(x => x === publickey))
            throw Error(`invalid account for siging, got ${Base58.encode(Buffer.from(publickey, "hex"))}`);


        this.#sigMap[publickey] = signature;
    }

    serialize(): Buffer {
        if (!this.#cache) throw Error("message serialization needed");

        const sigCount = encodeLength(this.#signedKeys.length);
        const size = sigCount.length + this.#signedKeys.length * SIGNATURE_LENGTH + this.#cache!.length;
        if (size > PACKET_DATA_SIZE) throw Error(`transaction too large (maximum: ${PACKET_DATA_SIZE}), got ${size}`);
        const wire = Buffer.alloc(size);

        let offset = sigCount.copy(wire);
        for (const key of this.#signedKeys) {
            const publickey = Buffer.from(key, "hex");
            const sig = this.#sigMap[key];

            if (sig) {
                if (!nacl.sign.detached.verify(this.#cache!, sig, publickey)) {
                    throw Error(`invalid signature, got ${sig.toString("hex")} for ${key}`);
                }

                sig.copy(wire, offset);
            }

            offset += SIGNATURE_LENGTH;
        }

        this.#cache!.copy(wire, offset);

        return wire;
    }

    get Signers() {
        if (!this.#cache) throw Error("message serialization needed");

        return [...this.#signedKeys];
    }

    get Version(): number | undefined { return undefined; }
    get numRequiredSignatures() { return this.#numRequiredSignatures; }
    get numReadonlySignedAccounts() { return this.#numReadonlySignedAccounts; }
    get numReadonlyUnsignedAccounts() { return this.#numReadonlyUnsignedAccounts; }
    get recentBlockhash() { return this.#recentBlockhash; }

    protected serializeMessage(feePayer?: HexString) {
        const { accountKeys, instructions } = this.makeIndexed(feePayer);

        const signData = Buffer.allocUnsafe(PACKET_DATA_SIZE);
        let offset = 0;

        const tx = {
            numRequiredSignatures: Buffer.from([this.#numRequiredSignatures]),
            numReadonlySignedAccounts: Buffer.from([this.#numReadonlySignedAccounts]),
            numReadonlyUnsignedAccounts: Buffer.from([this.#numReadonlyUnsignedAccounts]),
            keyCount: encodeLength(accountKeys.length),
            keys: accountKeys.map(x => Buffer.from(x, "hex")),
            recentBlockhash: Base58.decode(this.#recentBlockhash)
        };
        let layout = signDataLayout(tx);
        offset += layout.encode(tx, signData);

        const encodedInstructions = this.encodeInstructions(instructions);
        if (offset + encodedInstructions.length > PACKET_DATA_SIZE) {
            Error("Exceed the maximum over-the-wire size");
        }
        offset += encodeLength(instructions.length).copy(signData, offset);
        offset += encodedInstructions.copy(signData, offset);

        return signData.slice(0, offset);
    }

    protected deserializeMessage(data: Buffer) {
        const byteArray = [...data];

        this.#numRequiredSignatures = byteArray.shift()!;
        this.#numReadonlySignedAccounts = byteArray.shift()!;
        this.#numReadonlyUnsignedAccounts = byteArray.shift()!;

        const addKey = (src: Array<HexString>, size: number) => {
            for (let i = 0; i < size; i++) {
                const key = byteArray.splice(0, PUBLICKEY_LENGTH);
                src.push(Buffer.from(key).toString("hex"));
            }
        };
        const accountSize = decodeLength(byteArray);
        addKey(this.#signedKeys, this.#numRequiredSignatures - this.#numReadonlySignedAccounts);
        addKey(this.#readonlySignedKeys, this.#numReadonlySignedAccounts);
        addKey(this.#unsignedKeys, this.#numReadonlyUnsignedAccounts);
        addKey(this.#readonlyUnsignedKeys, accountSize - this.#numRequiredSignatures - this.#numReadonlyUnsignedAccounts);

        this.#recentBlockhash = Base58.encode(byteArray.splice(0, PUBLICKEY_LENGTH));

        const accountKeys = [
            ...this.#signedKeys,
            ...this.#readonlySignedKeys,
            ...this.#unsignedKeys,
            ...this.#readonlyUnsignedKeys
        ];
        this.#instructions.length = 0;
        const insSize = decodeLength(byteArray);
        for (let i = 0; i < insSize; i++) {
            const programIdIndex = byteArray.shift()!;
            const programId = accountKeys[programIdIndex];

            const accountsLen = decodeLength(byteArray);
            const accountIndices = byteArray.splice(0, accountsLen);
            const accounts = accountIndices.map(idx => ({
                publickey: accountKeys[idx],
                isSigner: idx < this.#numRequiredSignatures,
                isWritable:
                    idx < this.#numRequiredSignatures - this.#numReadonlySignedAccounts ||
                    (idx >= this.#numRequiredSignatures && idx < accountKeys.length - this.#numReadonlyUnsignedAccounts)
            }));

            const dataLen = decodeLength(byteArray);
            const data = Buffer.from(byteArray.splice(0, dataLen));

            this.#instructions.push({
                programId,
                accounts,
                data
            });
        }

        return byteArray;
    }

    protected makeIndexed(feePayer?: HexString) {
        if (this.#instructions.length === 0) throw Error("No instructions provided");

        const set = new Set<string>();
        if (feePayer) set.add(feePayer);

        const sortOptions: Intl.CollatorOptions = {
            localeMatcher: 'best fit',
            usage: 'sort',
            sensitivity: 'variant',
            ignorePunctuation: false,
            numeric: false,
            caseFirst: 'lower',
        };
        const customSort = (list: Array<string>) => {
            return list.sort((a, b) => {
                const _a = Base58.encode(Buffer.from(a, "hex"));
                const _b = Base58.encode(Buffer.from(b, "hex"));

                return _a.localeCompare(_b, "en", sortOptions);
            });
        };

        this.#signedKeys = customSort(this.#signedKeys);
        this.#signedKeys.forEach(x => set.add(x));
        this.#signedKeys = [...set];

        this.#readonlySignedKeys = customSort(this.#readonlySignedKeys);
        this.#readonlySignedKeys.forEach(x => set.add(x));
        this.#readonlySignedKeys = [...set].slice(this.#signedKeys.length);

        this.#numRequiredSignatures = set.size;
        this.#numReadonlySignedAccounts = this.#readonlySignedKeys.length;

        this.#unsignedKeys = customSort(this.#unsignedKeys);
        this.#unsignedKeys.forEach(x => set.add(x));
        this.#unsignedKeys = [...set].slice(this.#numRequiredSignatures);

        let cur = set.size;
        this.#readonlyUnsignedKeys = customSort(this.#readonlyUnsignedKeys);
        this.#readonlyUnsignedKeys.forEach(x => set.add(x));
        this.#readonlyUnsignedKeys = [...set].slice(cur);

        this.#numReadonlyUnsignedAccounts = this.#readonlyUnsignedKeys.length;

        const accountKeys = [...set];
        const indices: { [id: HexString]: number } = {};
        accountKeys.forEach((x, i) => indices[x] = i);


        const instructions = this.#instructions.map(ins => {
            const programIdIndex = accountKeys.findIndex(x => x === ins.programId);
            if (programIdIndex === -1) throw Error("Cannot reference program id");

            const keyIndicesCount = encodeLength(ins.accounts.length);
            const keyIndices = Buffer.from(ins.accounts.map(x => indices[x.publickey]));
            const dataLength = encodeLength(ins.data.length);

            return {
                programIdIndex,
                keyIndicesCount,
                keyIndices,
                dataLength,
                data: ins.data,
            };
        });

        return { accountKeys, instructions }
    }

    protected encodeInstructions(instructions: Array<InstructionData>) {
        const data = Buffer.allocUnsafe(PACKET_DATA_SIZE);
        let offset = 0;

        for (const ins of instructions) {
            const layout = instructionLayout(ins);
            offset += layout.encode(ins, data, offset);
        }

        return data.slice(0, offset);
    }
}

export type AddressLookup = {
    accountKey: HexString | Base58String,
    writableIndexes: number[],
    readonlyIndexes: number[]
}

const MESSAGE_VERSION_0_PREFIX = 1 << 7;
export class TransactionV0 extends Transaction {
    #addressTableLookups: Array<AddressLookup> = [];

    addAddressLookup(lookup: AddressLookup) {
        if (!/[0-9a-fA-F]{64}/.test(lookup.accountKey)) {
            lookup.accountKey = toPublickey(lookup.accountKey);
        }

        this.#addressTableLookups.push(lookup);
    }

    protected serializeMessage(feePayer?: HexString) {
        const { accountKeys, instructions } = this.makeIndexed(feePayer);
        const serializedMessage = Buffer.allocUnsafe(PACKET_DATA_SIZE);

        const message: MessageData = {
            prefix: MESSAGE_VERSION_0_PREFIX,
            header: {
                numRequiredSignatures: this.numRequiredSignatures,
                numReadonlySignedAccounts: this.numReadonlySignedAccounts,
                numReadonlyUnsignedAccounts: this.numReadonlyUnsignedAccounts
            },
            staticAccountKeysLength: encodeLength(accountKeys.length),
            staticAccountKeys: accountKeys.map(x => Buffer.from(x, "hex")),
            recentBlockhash: Base58.decode(this.recentBlockhash),
            instructionsLength: encodeLength(instructions.length),
            serializedInstructions: this.encodeInstructions(instructions),
            addressTableLookupsLength: encodeLength(this.#addressTableLookups.length),
            serializedAddressTableLookups: this.encodeAddressTableLookups(this.#addressTableLookups)
        };
        const offset = messageLayout(message).encode(message, serializedMessage);

        return serializedMessage.slice(0, offset);
    }

    protected deserializeMessage(data: Buffer) {
        const prefix = data[0];
        const version = prefix & VERSION_PREFIX_MASK;
        if (prefix === version) {
            throw Error("expected versioned message but received legacy message");
        }
        if (version !== this.Version) {
            throw Error(`expected versioned message with version ${this.Version} but found version ${version}`);
        }

        const byteArray = super.deserializeMessage(data.slice(1));

        this.#addressTableLookups.length = 0;
        const addressTableLookupsCount = decodeLength(byteArray);
        for (let i = 0; i < addressTableLookupsCount; i++) {
            const key = byteArray.splice(0, PUBLICKEY_LENGTH);
            const accountKey = Buffer.from(key).toString("hex");
            const writableLength = decodeLength(byteArray);
            const writableIndexes = byteArray.splice(0, writableLength);
            const readonlyLength = decodeLength(byteArray);
            const readonlyIndexes = byteArray.splice(0, readonlyLength);

            this.#addressTableLookups.push({
                accountKey,
                writableIndexes,
                readonlyIndexes
            });
        }

        return byteArray;
    }

    protected encodeAddressTableLookups(table: Array<AddressLookup>) {
        const data = Buffer.allocUnsafe(PACKET_DATA_SIZE);
        let offset = 0;

        for (const { accountKey, writableIndexes, readonlyIndexes } of table) {
            const lookup: AddressTableLookupData = {
                accountKey: Buffer.from(accountKey, "hex"),
                encodedWritableIndexesLength: encodeLength(writableIndexes.length),
                writableIndexes: writableIndexes,
                encodedReadonlyIndexesLength: encodeLength(readonlyIndexes.length),
                readonlyIndexes: readonlyIndexes
            };
            offset += addressTableLookupLayout(lookup).encode(lookup, data, offset);
        }

        return data.slice(0, offset);
    }

    get Version() { return 0; }
}


function encodeLength(len: number): Buffer {
    const bytes: number[] = [];
    while (true) {
        let elem = len & 0x7f;
        len >>= 7;
        if (len == 0) {
            bytes.push(elem);
            break;
        } else {
            elem |= 0x80;
            bytes.push(elem);
        }
    }

    return Buffer.from(bytes);
}

function decodeLength(bytes: Array<number>): number {
    let len = 0;
    let size = 0;
    while (true) {
        let elem = bytes.shift()!;
        len |= (elem & 0x7f) << (size * 7);
        size += 1;
        if ((elem & 0x80) === 0) {
            break;
        }
    }
    return len;
}
