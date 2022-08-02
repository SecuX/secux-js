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
import { keccak256 } from "js-sha3";
import * as rlp from "rlp";
import { BigNumber } from 'bignumber.js';
import ow from "ow";
import { ow_tx1559 } from './interface';
export { getBuilder, ETHTransactionBuilder, EIP1559Builder };


const EIP1559_TransactionType = Buffer.from([0x02]);


function getBuilder(data: any) {
    try {
        ow(data, ow_tx1559);
        return new EIP1559Builder(data);
    } catch (error) { }

    return new ETHTransactionBuilder(data);
}

class ETHTransactionBuilder {
    #tx: any;

    static deserialize(serialized: Buffer): ETHTransactionBuilder {
        // legacy transaction
        if (serialized[0] >= 0xc0) {
            const values = rlp.decode(serialized);
            if (!Array.isArray(values)) throw new Error('Invalid serialized tx input. Must be array');
            if (values.length !== 6 && values.length !== 9) {
                throw new Error('Invalid transaction. Only expecting unsigned tx with 6 values (legacy) or 9 values (EIP155).');
            }

            const [nonce, gasPrice, gasLimit, to, value, data, v, r, s] = values;
            const _v = parseInt(Buffer.from(v).toString("hex"), 16);
            let chainId = undefined;
            if (![0, 27, 28].includes(_v)) chainId = v;

            return new ETHTransactionBuilder({
                nonce,
                gasPrice,
                gasLimit,
                to,
                value,
                data,
                chainId
            });
        }

        // typed transaction
        if (serialized[0] <= 0x7f) {
            const values = rlp.decode(serialized.slice(1));
            if (!Array.isArray(values)) throw new Error('Invalid serialized tx input. Must be array');
            if (values.length !== 9) {
                throw new Error('Invalid transaction. Only expecting unsigned tx with 9 values (EIP1559).');
            }

            const [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data] = values;

            return new EIP1559Builder({
                chainId,
                nonce,
                maxPriorityFeePerGas,
                maxFeePerGas,
                gasLimit,
                to,
                value,
                data
            });
        }

        throw Error(`Invalid serialized tx input, got "${serialized.toString("hex")}"`);
    }

    constructor(tx: any) {
        this.#tx = { ...tx };

        if (typeof tx.chainId === "string") {
            this.#tx.chainId = Buffer.from(tx.chainId.slice(2), "hex");
        }
        else if (typeof tx.chainId === "number") {
            let str = tx.chainId.toString(16);
            if (str.length % 2 !== 0) str = `0${str}`;
            this.#tx.chainId = Buffer.from(str, "hex");
        }

        if (tx.gasPrice) {
            const gasPrice = getValue(tx.gasPrice);
            if (gasPrice.lt(1e9)) throw Error(`Minimal gas price is 1 Gwei, but got ${gasPrice.div(1e9).toString()} Gwei.`);
        }

        if (tx.maxPriorityFeePerGas) {
            const priorityFee = getValue(tx.maxPriorityFeePerGas);
            if (priorityFee.lt(1)) throw Error(`[maxPriorityFeePerGas] Minimal priority fee is 1 wei.`);
        }

        if (tx.maxFeePerGas) {
            const maxFee = getValue(tx.maxFeePerGas);
            if (maxFee.lt(1e9)) throw Error(`[maxFeePerGas] Minimal fee is 1 Gwei, but got ${maxFee.div(1e9).toString()} Gwei.`);
        }

        // According to Ethereum Yellow Paper(https://ethereum.github.io/yellowpaper/paper.pdf)
        // gasLimit = G_transaction + G_txdatanonzero × dataByteLength
        // where:
        //      G_transaction = 21000 gas
        //      G_txdatanonzero = 68 gas
        //      dataByteLength — your data size in bytes
        let estimatedGas = 21000;
        if (tx.data) {
            if (typeof tx.data === "string") {
                estimatedGas += (tx.data.length / 2 - 1) * 68;
            }
            else {
                estimatedGas += tx.data.length * 68;
            }
        }
        const gasLimit = getValue(tx.gasLimit);
        if (gasLimit.lt(estimatedGas)) throw Error(`Minimal gas is ${estimatedGas}, but got ${gasLimit.toString()}.`);
    }

    /**
     * 
     * @param {boolean} toHash 
     * @returns {Buffer} transaction (keccak256 hashed or not)
     */
    serialize(toHash: boolean = false): Buffer {
        const transaction = [
            ...this.prepare(),
            handleRLPValue(this.#tx.chainId ?? 0x00),
            0x00, // zero rlp to 80
            0x00
        ];

        const encoded = rlp.encode(transaction);

        return (toHash) ? Buffer.from(keccak256.update(encoded).digest()) : encoded;
    }

    /**
     * sign transaction
     * @param {string} signature 
     * @returns {Buffer} signed transaction
     */
    withSignature(sig: Buffer): Buffer {
        if (!this.verify(sig)) throw Error("invalid signature");

        sig = this.getSignature(sig);
        const transaction = [
            ...this.prepare(),
            handleRLPValue(sig.slice(64)),
            trimZeroForRLP(sig.slice(0, 32)),
            trimZeroForRLP(sig.slice(32, 64))
        ];

        return rlp.encode(transaction);
    }

    getSignature(sig: Buffer): Buffer {
        const chainId = parseInt(Buffer.from(this.#tx.chainId ?? [0]).toString("hex"), 16);
        const offset = (chainId > 0) ? chainId * 2 + 35 : 27;
        let v_hex = (sig[64] + offset).toString(16);
        if (v_hex.length % 2 !== 0) v_hex = `0${v_hex}`;
        const v = Buffer.from(v_hex, "hex");

        return Buffer.concat([
            sig.slice(0, 64),
            v
        ]);
    }

    protected prepare() {
        return [
            handleRLPValue(this.#tx.nonce),
            handleRLPValue(this.#tx.gasPrice),
            handleRLPValue(this.#tx.gasLimit),
            this.#tx.to,
            handleRLPValue(this.#tx.value),
            this.#tx.data ?? '', // empty string rlp to 80
        ];
    }

    protected verify(data: Buffer): boolean {
        const sig = data.slice(0, 64);
        try {
            secp256k1.ecdsaRecover(sig, data.readUint8(64), this.serialize(true));
        } catch (error) {
            return false;
        }

        return true;
    }

    get chainId() {
        if (!this.#tx.chainId) return undefined;

        return parseInt(Buffer.from(this.#tx.chainId).toString("hex"), 16);
    }

    get tx() { return this.#tx; }
}

class EIP1559Builder extends ETHTransactionBuilder {
    serialize(toHash: boolean = false): Buffer {
        const transaction = this.prepare();

        const encoded = Buffer.concat([
            EIP1559_TransactionType,
            rlp.encode(transaction)
        ]);

        return (toHash) ? Buffer.from(keccak256.update(encoded).digest()) : encoded;
    }

    withSignature(sig: Buffer): Buffer {
        if (!this.verify(sig)) throw Error("invalid signature");

        const transaction = [
            ...this.prepare(),
            handleRLPValue(sig[64]),
            trimZeroForRLP(sig.slice(0, 32)),
            trimZeroForRLP(sig.slice(32, 64))
        ];
        const encoded = rlp.encode(transaction);

        return Buffer.concat([
            EIP1559_TransactionType,
            encoded
        ]);
    }

    getSignature(sig: Buffer): Buffer {
        return sig;
    }

    protected prepare() {
        return [
            handleRLPValue(this.tx.chainId),
            handleRLPValue(this.tx.nonce),
            handleRLPValue(this.tx.maxPriorityFeePerGas),
            handleRLPValue(this.tx.maxFeePerGas),
            handleRLPValue(this.tx.gasLimit),
            this.tx.to,
            handleRLPValue(this.tx.value),
            this.tx.data ?? '', // empty string rlp to 80
            this.tx.accessList ?? []
        ];
    }
}


function handleRLPValue(input: rlp.Input) {
    if (typeof input === 'string') {
        if (input.startsWith('0x') && isHex(input)) {
            if (input == '0x0' || input == '0x00') return 0;

            return input;
        }
        else {
            throw Error('Invalid handleRLPValue string');
        }
    }

    return input;
}

function isHex(str: string) {
    let newStr = str.startsWith('0x') ? str.slice(2) : str;
    const regexp = /^[0-9a-fA-F]+$/;
    newStr = newStr.length % 2 === 0 ? newStr : `0${newStr}`;

    return regexp.test(newStr);
}

function trimZeroForRLP(data: Buffer) {
    const hex = data.toString("hex");
    const zeros = (hex.match(/^(00)+/g) ?? [''])[0].length / 2;

    return data.slice(zeros);
}

function getValue(data: number | string | Uint8Array): BigNumber {
    if (typeof data === "number") return new BigNumber(data);

    if (typeof data === "string") {
        if (data.startsWith("0x")) return new BigNumber(data.slice(2), 16);
        else return new BigNumber(data);
    }

    return new BigNumber(Buffer.from(data).toString("hex"), 16);
}