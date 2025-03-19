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


const bip66 = require("bip66");
import { OPCODES } from "./coindef";
import * as scriptNumber from './script_number';
import { Logger } from '@secux/utility';
const ZERO = Buffer.alloc(1, 0);
const logger = Logger?.child({ id: "script" });


export function compile(chunks: any[]) {
    const bufferSize = chunks.reduce((accum, chunk) => {
        // data chunk
        if (Buffer.isBuffer(chunk)) {
            // adhere to BIP62.3, minimal push policy
            if (chunk.length === 1 && asMinimalOP(chunk) !== undefined) {
                return accum + 1;
            }
            return accum + pushdata.encodingLength(chunk.length) + chunk.length;
        }

        // opcode
        return accum + 1;
    }, 0);

    const buffer = Buffer.allocUnsafe(bufferSize);
    let offset = 0;
    for (const chunk of chunks) {
        // data chunk
        if (Buffer.isBuffer(chunk)) {
            // adhere to BIP62.3, minimal push policy
            const opcode = asMinimalOP(chunk);
            if (opcode !== undefined) {
                buffer.writeUInt8(opcode, offset);
                offset += 1;
                continue;
            }
            offset += pushdata.encode(buffer, chunk.length, offset);
            chunk.copy(buffer, offset);
            offset += chunk.length;
        }
        // opcode
        else {
            buffer.writeUInt8(chunk, offset);
            offset += 1;
        }
    }

    if (offset !== buffer.length) throw new Error('Could not decode chunks');

    return buffer;
}

export function decompile(buffer: Buffer) {
    const chunks: (number | Buffer)[] = [];
    let i = 0;
    while (i < buffer.length) {
        const opcode = buffer[i];

        // data chunk
        if (opcode > OPCODES.OP_0 && opcode <= OPCODES.OP_PUSHDATA4) {
            const d = pushdata.decode(buffer, i);
            // did reading a pushDataInt fail?
            if (d === null) {
                logger?.warn(`decompile error: reading a pushDataInt fail, got ${buffer.toString("binary")}, index:${i}`);
                return [];
            }
            i += d.size;
            // attempt to read too much data?
            if (i + d.number > buffer.length) {
                logger?.warn(`decompile error: attempt to read too much data, got ${buffer.slice(i).toString("binary")}, desired length:${d.number}`);
                return [];
            }
            const data = buffer.slice(i, i + d.number);
            i += d.number;
            // decompile minimally
            const op = asMinimalOP(data);
            if (op !== undefined) {
                chunks.push(op);
            } else {
                chunks.push(data);
            }
        }
        // opcode
        else {
            chunks.push(opcode);
            i += 1;
        }
    }

    return chunks;
}


// BIP62: 1 byte hashType flag (only 0x01, 0x02, 0x03, 0x81, 0x82 and 0x83 are allowed)
export function decode(buffer: Buffer) {
    const hashType = buffer.readUInt8(buffer.length - 1);
    const hashTypeMod = hashType & ~0x80;

    if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType);

    const decoded = bip66.decode(buffer.slice(0, -1));
    const r = fromDER(decoded.r);
    const s = fromDER(decoded.s);
    const signature = Buffer.concat([r, s], 64);

    return { signature, hashType };
}

export function encode(signature: Buffer, hashType: number) {
    const hashTypeBuffer = Buffer.allocUnsafe(1);
    hashTypeBuffer.writeUInt8(hashType, 0);
    const r = toDER(signature.slice(0, 32));
    const s = toDER(signature.slice(32, 64));

    return Buffer.concat([bip66.encode(r, s), hashTypeBuffer]);
}

export function toStack(chunks: any[]) {
    if (Buffer.isBuffer(chunks)) chunks = decompile(chunks);

    const stack = chunks.map(op => {
        if (Buffer.isBuffer(op)) return op;
        if (op === OPCODES.OP_0) return Buffer.allocUnsafe(0);

        return scriptNumber.encode(op - OPCODES.OP_INT_BASE);
    });
    
    return stack;
}

function toDER(x: Buffer) {
    let i = 0;
    while (x[i] === 0) ++i;
    if (i === x.length) return ZERO;

    x = x.slice(i);
    if (x[0] & 0x80) return Buffer.concat([ZERO, x], 1 + x.length);

    return x;
}

function fromDER(x: Buffer) {
    if (x[0] === 0x00) x = x.slice(1);

    const buffer = Buffer.alloc(32, 0);
    const bstart = Math.max(0, 32 - x.length);
    x.copy(buffer, bstart);

    return buffer;
}

function asMinimalOP(buffer: Buffer) {
    if (buffer.length === 0) return OPCODES.OP_0;
    if (buffer.length !== 1) return;
    if (buffer[0] >= 1 && buffer[0] <= 16) return OPCODES.OP_INT_BASE + buffer[0];
    if (buffer[0] === 0x81) return OPCODES.OP_1NEGATE;
}


class pushdata {
    static encodingLength(i: number) {
        if (i < OPCODES.OP_PUSHDATA1) return 1;
        if (i <= 0xff) return 2;
        if (i <= 0xffff) return 3;

        return 5;
    }

    static encode(buffer: Buffer, number: number, offset: number) {
        const size = this.encodingLength(number);

        // ~6 bit
        if (size === 1) {
            buffer.writeUInt8(number, offset);

        }
        // 8 bit
        else if (size === 2) {
            buffer.writeUInt8(OPCODES.OP_PUSHDATA1, offset);
            buffer.writeUInt8(number, offset + 1);

        }
        // 16 bit
        else if (size === 3) {
            buffer.writeUInt8(OPCODES.OP_PUSHDATA2, offset);
            buffer.writeUInt16LE(number, offset + 1);
        }
        // 32 bit
        else {
            buffer.writeUInt8(OPCODES.OP_PUSHDATA4, offset);
            buffer.writeUInt32LE(number, offset + 1);
        }

        return size;
    }

    static decode(buffer: Buffer, offset: number) {
        const opcode = buffer.readUInt8(offset);
        let number, size;

        // ~6 bit
        if (opcode < OPCODES.OP_PUSHDATA1) {
            number = opcode;
            size = 1;

        }
        // 8 bit
        else if (opcode === OPCODES.OP_PUSHDATA1) {
            if (offset + 2 > buffer.length) return null;

            number = buffer.readUInt8(offset + 1);
            size = 2;
        }
        // 16 bit
        else if (opcode === OPCODES.OP_PUSHDATA2) {
            if (offset + 3 > buffer.length) return null;

            number = buffer.readUInt16LE(offset + 1);
            size = 3;
        }
        // 32 bit
        else {
            if (offset + 5 > buffer.length) return null;
            if (opcode !== OPCODES.OP_PUSHDATA4) throw new Error('Unexpected opcode');

            number = buffer.readUInt32LE(offset + 1);
            size = 5;
        }

        return {
            opcode: opcode,
            number: number,
            size: size
        }
    }
}
