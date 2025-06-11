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


import { PsbtInputExtended, PsbtOutputExtended, PsbtInput } from "bip174/src/lib/interfaces";
import { checkForInput } from "bip174/src/lib/utils";
const secp256k1 = require('secp256k1/elliptic');
import { sha256 } from "hash.js";
import { BigNumber } from "bignumber.js";
import { Psbtv2 } from "./parser";
import * as Script from "./script";
import { buildPathBuffer, BigIntToBuffer, Logger, isSupportedCoin } from '@secux/utility';
import {
    CoinType, ScriptType, txInput, txOutputExtended,
    isOutputAddress, isOutuptScriptExtended, isOutuptScript
} from './interface';
import {
    getDefaultScript, getDustThreshold, getInScriptSize, getPayment, getPublickey, getSerializer, getWitnessSize,
    scriptWitnessToWitnessStack, taggedHash, toTweakedPublickey, vectorSize, witnessStackToScriptWitness
} from './utils';
import { Hash160, PaymentBTC } from './payment';
import { Transaction } from "./transaction";
import { OPCODES } from "./coindef";
import { communicationData, MAX_HEAD_SIZE, ONESIGN_THRESHOLD } from "@secux/utility/lib/communication";
import { SecuxTransactionTool } from "@secux/protocol-transaction/lib/protocol-transaction";
import { taprootVerify } from "./bip340";
export { SecuxPsbt };
const logger = Logger?.child({ id: "psbt" });


const SIGHASH_FORKID = 0x40;
const dustRelayFee = 3;


class SecuxPsbt {
    readonly #data: Psbtv2;
    readonly #coin: CoinType;
    readonly #payment: typeof PaymentBTC;
    readonly #tx: any;
    #isRBF: boolean;
    #paths: Array<string> = [];
    #inScripts: { [index: number]: { type: ScriptType, scriptPubkey: Buffer } } = {};
    #multiSig = {
        m: 0,
        publickeys: [] as Array<Buffer>,
        scriptPublickey: undefined as Buffer | undefined,
        witnessScript: undefined as Buffer | undefined,
    };


    constructor(coin: CoinType, isRBF = false, data = new Psbtv2(new PsbtTransaction())) {
        this.#data = data;
        this.#coin = coin;
        this.#payment = getPayment(this.#coin);
        this.#isRBF = isRBF;

        //@ts-ignore
        this.#tx = this.#data.globalMap.unsignedTx.tx;

        if (coin === CoinType.BITCOINCASH) this.#tx.version = 1;
    }

    static FromBuffer(data: Buffer, coin: CoinType): SecuxPsbt {
        const psbtBase = Psbtv2.fromBuffer(data, x => new PsbtTransaction(x));
        const psbt = new SecuxPsbt(coin, false, psbtBase);

        return psbt;
    }

    toBuffer(): Buffer {
        return this.#data.toBuffer();
    }

    AddInput(input: txInput): SecuxPsbt {
        if (!isSupportedCoin(input.path)) throw Error(`ArgumentError: unsupport bip32 path, got "${input.path}"`);

        const mix1: any = {};
        const mix2: any = {};

        const publickey = getPublickey(input.publickey!);
        const script = input.script ?? getDefaultScript(input.path);
        const value = new BigNumber(input.satoshis).toNumber();
        switch (script) {
            case ScriptType.P2PKH:
                mix1.witnessUtxo = {
                    script: this.#payment.p2pkh(this.#coin, { publickey }).scriptPublickey,
                    value
                };
                break;

            case ScriptType.P2SH_P2PKH:
                const p2pkh = this.#payment.p2pkh(this.#coin, { publickey });
                mix2.redeemScript = p2pkh.scriptPublickey;

                mix1.witnessUtxo = {
                    script: this.#payment.p2sh(this.#coin, { redeemScript: p2pkh.scriptPublickey }).scriptPublickey,
                    value
                };
                break;

            case ScriptType.P2SH_P2WPKH:
                const p2wpkh = this.#payment.p2wpkh(this.#coin, { publickey });
                mix2.redeemScript = p2wpkh.scriptPublickey;

                mix1.witnessUtxo = {
                    script: this.#payment.p2sh(this.#coin, { redeemScript: p2wpkh.scriptPublickey }).scriptPublickey,
                    value
                };
                break;

            case ScriptType.P2WPKH:
                mix1.witnessUtxo = {
                    script: this.#payment.p2wpkh(this.#coin, { publickey }).scriptPublickey,
                    value
                };
                break;

            case ScriptType.P2TR:
                mix1.witnessUtxo = {
                    script: this.#payment.p2tr(this.#coin, { publickey }).scriptPublickey,
                    value
                };
                mix2.sighashType = Transaction.SIGHASH_ALL | Transaction.SIGHASH_ANYONECANPAY;
                break;

            default:
                throw Error(`ArgumentError: Invalid ScriptType of input#${this.#data.inputs.length}, got "${ScriptType[script]}"`);
        }

        // check input
        if (input.txHex) {
            const tx = Transaction.fromBuffer(Buffer.from(input.txHex, "hex"));

            if (getSerializer(this.#coin).getId(tx) !== input.hash) {
                throw Error(
                    `UTXO hash for input #${this.#data.inputs.length} doesn't match the hash specified in the prevout`,
                );
            }

            const out = tx.outs[input.vout];
            if (!new BigNumber(out.value).eq(input.satoshis)) {
                throw Error(
                    `UTXO value for input #${this.#data.inputs.length} doesn't match the value specified in the prevout`,
                );
            }

            if (!out.script.equals(mix1.witnessUtxo.script)) {
                logger?.warn(`Input script generation error: ${out.script.toString("hex")}, got "${mix1.witnessUtxo.script}"`);
            }
        }

        const data = {
            hash: input.hash,
            index: input.vout,
            sequence: this.#isRBF ? 0xfffffffd : undefined,
            ...mix1,
            ...mix2
        };
        this.#data.addInput(data);

        this.#paths.push(input.path);

        return this;
    }

    AddInputs(inputs: Array<txInput>): SecuxPsbt {
        for (const input of inputs) {
            this.AddInput(input);
        }

        return this;
    }

    initializeMultiSig(m: number, publickeys: Array<string | Buffer>) {
        if (![CoinType.BITCOIN, CoinType.TESTNET, CoinType.REGTEST].includes(this.#coin)) {
            throw Error(`unsupported chain: ${CoinType[this.#coin]}`);
        }

        this.#multiSig.m = m;
        const pks = publickeys.map(pk => getPublickey(pk));
        this.#multiSig.publickeys = pks;

        const p2ms = this.#payment.p2ms(m, pks);
        const redeemScript = p2ms.scriptPubicKey;
        const p2wsh = this.#payment.p2wsh(this.#coin, { redeemScript });
        this.#multiSig.scriptPublickey = p2wsh.scriptPublickey;
        this.#multiSig.witnessScript = redeemScript;

        return {
            address: p2wsh.address,
            redeemScript: redeemScript.toString("hex"),
        }
    }

    addMultiSigInput(input: {
        hash: string,
        vout: number,
        satoshis: number | string,
        txHex?: string, 
    }) {
        const mix1: any = {};
        const mix2: any = {};
        const value = new BigNumber(input.satoshis).toNumber();

        mix2.witnessScript = this.#multiSig.witnessScript;

        mix1.witnessUtxo = {
            script: this.#multiSig.scriptPublickey,
            value
        };

        // check input
        if (input.txHex) {
            const tx = Transaction.fromBuffer(Buffer.from(input.txHex, "hex"));

            if (getSerializer(this.#coin).getId(tx) !== input.hash) {
                throw Error(
                    `UTXO hash for input #${this.#data.inputs.length} doesn't match the hash specified in the prevout`,
                );
            }

            const out = tx.outs[input.vout];
            if (!new BigNumber(out.value).eq(input.satoshis)) {
                throw Error(
                    `UTXO value for input #${this.#data.inputs.length} doesn't match the value specified in the prevout`,
                );
            }

            if (!out.script.equals(mix1.witnessUtxo.script)) {
                logger?.warn(`Input script generation error: ${out.script.toString("hex")}, got "${mix1.witnessUtxo.script}"`);
            }
        }

        const data = {
            hash: input.hash,
            index: input.vout,
            sequence: this.#isRBF ? 0xfffffffd : undefined,
            ...mix1,
            ...mix2
        };
        this.#data.addInput(data);

        return this;
    }

    AddOutput(output: txOutputExtended): SecuxPsbt {
        let out, script, path: any;
        let value = new BigNumber(output.satoshis).toNumber();
        if ((out = isOutuptScriptExtended(output))) {
            const pk = getPublickey(out.publickey!);
            path = out.path;

            const scriptType = out.script ?? getDefaultScript(path);
            switch (scriptType) {
                case ScriptType.P2SH_P2WPKH: {
                    if (!out.path.startsWith("m/49'/")) throw Error("P2SH(...) should use m/49' path");

                    const p2wpkh = this.#payment.p2wpkh(this.#coin, { publickey: pk });
                    const p2sh = this.#payment.p2sh(this.#coin, { redeemScript: p2wpkh.scriptPublickey });
                    script = p2sh.scriptPublickey;
                    break;
                }

                case ScriptType.P2SH_P2PKH: {
                    if (!out.path.startsWith("m/49'/")) throw Error("P2SH(...) should use m/49' path");

                    const p2pkh = this.#payment.p2pkh(this.#coin, { publickey: pk });
                    const p2sh = this.#payment.p2sh(this.#coin, { redeemScript: p2pkh.scriptPublickey });
                    script = p2sh.scriptPublickey;
                    break;
                }

                case ScriptType.P2PKH: {
                    if (!out.path.startsWith("m/44'/")) throw Error("P2PKH should use m/44' path");

                    const p2pkh = this.#payment.p2pkh(this.#coin, { publickey: pk });
                    script = p2pkh.scriptPublickey;
                    break;
                }

                case ScriptType.P2WPKH: {
                    if (!out.path.startsWith("m/84'/")) throw Error("P2WPKH should use m/84' path");
                    
                    const p2wpkh = this.#payment.p2wpkh(this.#coin, { publickey: pk });
                    script = p2wpkh.scriptPublickey;
                    break;
                }

                case ScriptType.P2TR: {
                    if (!out.path.startsWith("m/86'/")) throw Error("P2TR should use m/86' path");

                    const p2tr = this.#payment.p2tr(this.#coin, { publickey: pk });
                    script = p2tr.scriptPublickey;
                    break;
                }

                default:
                    throw Error(`ArgumentError: Invalid ScriptType of output#${this.#data.outputs.length}, got "${ScriptType[scriptType]}"`);
            }
        }
        else if ((out = isOutputAddress(output))) {
            script = this.#payment.decode(this.#coin, out.address);
        }
        else if ((out = isOutuptScript(output))) {
            script = Buffer.from(out.scriptHex, "hex");
        }
        else throw Error("Invalid parameter of output");

        this.#data.addOutput({
            script,
            value,
            path
        });

        return this;
    }

    AddOutputs(outputs: Array<txOutputExtended>): SecuxPsbt {
        for (const output of outputs) {
            this.AddOutput(output);
        }

        return this;
    }

    PrepareSign(feeRate?: number): { commands: Array<communicationData>, rawTx: string } {
        // treat last output as change
        if (feeRate) this.#modifyByFee(feeRate, this.#tx.outs.length - 1);
        this.#checkDust(!!feeRate);

        const outConfirm = Buffer.from([
            this.#data.outputs.length,

            ...BigIntToBuffer(this.#tx.outs[0].value, 8),
            this.#tx.outs[0].script.length,
            ...this.#tx.outs[0].script,

            ...this.#tx.outs.slice(1).reduce((data: number[], out: any) => [
                ...data,
                ...BigIntToBuffer(out.value, 8),
                ...buildPathBuffer(out.path!).pathBuffer
            ], [])
        ]);

        const txs = this.#data.inputs.map((_, i) => {
            const data = this.getDataForSig(i);
            logger?.debug(`tx data [${i}]: ${data.toString("hex")}`);

            if (data.length + MAX_HEAD_SIZE > ONESIGN_THRESHOLD) {
                throw Error("ArgumentError: utxo exceed maximum payload size");
            }

            return data;
        });
        logger?.debug(`confirm data: ${outConfirm.toString("hex")}`);

        const commands: Array<communicationData> = [];
        let _txs: Array<Buffer> = [], _paths: Array<string> = [];
        let confirmBuf = (
            this.#coin !== CoinType.BITCOINCASH &&
            this.#fetchInputScript(0).type === ScriptType.P2PKH
        ) ? Buffer.alloc(0) : outConfirm;

        for (let i = 0, size = 0; i < txs.length; i++) {
            size += txs[i].length + MAX_HEAD_SIZE;
            _txs.push(txs[i]);
            _paths.push(this.#paths[i]);
            if (size + confirmBuf.length < ONESIGN_THRESHOLD) continue;

            _txs.pop();
            _paths.pop();
            commands.push(
                SecuxTransactionTool.signRawTransactionList(_paths, _txs, confirmBuf)
            );

            size = txs[i].length + MAX_HEAD_SIZE;
            _txs = [txs[i]];
            _paths = [this.#paths[i]];

            const { type } = this.#fetchInputScript(i);
            if (this.#coin !== CoinType.BITCOINCASH && type === ScriptType.P2PKH) {
                confirmBuf = Buffer.alloc(0);
            }
            else {
                confirmBuf = outConfirm;
            }
        }

        if (_txs.length > 0) {
            commands.push(
                SecuxTransactionTool.signRawTransactionList(_paths, _txs, confirmBuf)
            );
        }

        return {
            commands,
            rawTx: this.#data.toHex()
        }
    }

    appendSignature(signatures: Array<Buffer>, publickeys: Array<Buffer>): SecuxPsbt {
        if (signatures.length !== publickeys.length)
            throw Error(`ArgumentError: each signature is correspond to one publickey, \
                got ${signatures.length} signatures and ${publickeys.length} publickeys`);

        for (let i = 0; i < this.#data.inputs.length; i++) {
            const data = this.getDataForSig(i);

            if (this.#fetchInputScript(i).type !== ScriptType.P2TR) {
                const hash = (this.#coin === CoinType.GROESTL) ? Buffer.from(sha256().update(data).digest())
                    : Buffer.from(sha256().update(sha256().update(data).digest()).digest());
                const publickey = publickeys[i];

                if (!secp256k1.ecdsaVerify(signatures[i], hash, publickey)) throw Error(`Signature Error #${i}`);

                let sighashType = this.#data.inputs[i].sighashType ?? Transaction.SIGHASH_ALL;
                if (this.#coin === CoinType.BITCOINCASH) sighashType = sighashType | SIGHASH_FORKID;

                const partialSig = [
                    {
                        pubkey: publickey,
                        signature: Script.encode(signatures[i], sighashType),
                    },
                ];
                this.#data.updateInput(i, { partialSig });
            }
            else {
                const hash = taggedHash("TapSighash", data);
                const tweaked = toTweakedPublickey(publickeys[i]);
                const signature = signatures[i].slice(0, 64);
                if (!taprootVerify(signature, hash, tweaked)) throw Error(`Signature Error #${i}`);

                const sighashType = this.#data.inputs[i].sighashType ?? Transaction.SIGHASH_DEFAULT;
                this.#data.inputs[i].partialSig = [
                    {
                        pubkey: tweaked,
                        signature: (sighashType === Transaction.SIGHASH_DEFAULT) ? signature
                            : Buffer.from([...signature, sighashType])
                    },
                ];
            }
        }

        return this;
    }

    submitSignature(index: number, data: { publickey: Buffer, signature: Buffer }): SecuxPsbt {
        const input = this.#data.inputs[index];
        if (!input.partialSig) input.partialSig = [];

        const sighashType = input.sighashType ?? Transaction.SIGHASH_ALL;
        this.#data.updateInput(index, {
            partialSig: [{
                pubkey: data.publickey,
                signature: Script.encode(data.signature, sighashType),
            }]
        })

        return this;
    }

    finalizeAllInputs(): SecuxPsbt {
        if (this.#data.inputs.length < 1) throw Error("utxo input cannot be empty");

        this.#data.inputs.forEach((input, idx) => {
            checkForInput(this.#data.inputs, idx);

            const { script, scriptType } = getScriptFromInput(input, this.#coin);

            if (!script) throw new Error(`No script found for input #${idx}`);
            this.#checkSighashType(input, scriptType);
            const { finalScriptSig, finalScriptWitness } = prepareFinalScripts(scriptType!, input);

            if (finalScriptSig) this.#data.updateInput(idx, { finalScriptSig });
            if (finalScriptWitness) this.#data.updateInput(idx, { finalScriptWitness });
            if (!finalScriptSig && !finalScriptWitness) throw new Error(`Unknown error finalizing input #${idx}`);
        });

        return this;
    }

    extractTransaction() {
        const tx = this.#tx.clone();
        this.#data.inputs.forEach((input, idx) => this.#extractInput(tx, idx, input));

        const input = this.#data.inputs.reduce((sum, txIn) => sum.plus(txIn.witnessUtxo!.value), new BigNumber(0));
        const output = (tx.outs as any[]).reduce((sum, txOut) => sum.plus(txOut.value), new BigNumber(0));
        const fee = input.minus(output);
        const minFee = tx.virtualSize();
        if (fee.lt(minFee)) throw Error(`Transaction fee must >= ${minFee}, but got ${fee}.`);

        return tx;
    }

    virtualSize(): number {
        const tx = this.#tx.clone();
        this.#data.inputs.forEach((input, idx) => this.#extractInput(tx, idx, input));

        return tx.virtualSize();
    }

    #fetchInputScript(index: number) {
        if (this.#inScripts[index]) return this.#inScripts[index];

        const txIn = this.#data.inputs[index];
        const prevout = txIn.witnessUtxo!;
        const type = getScriptFromInput(txIn, this.#coin).scriptType!;
        const scriptPubkey = getMeaningfulScript(
            prevout.script,
            type,
            txIn.redeemScript,
        );

        logger?.debug(`input #${index} script type: ${ScriptType[type]}`);
        logger?.debug(`script: ${scriptPubkey.toString("hex")}`);

        const obj = { type, scriptPubkey };
        this.#inScripts[index] = obj;

        return obj;
    }

    getDataForSig(inputIndex: number): Buffer {
        const txIn = this.#data.inputs[inputIndex];
        const unsignedTx: Transaction = this.#tx;
        let sighashType = txIn.sighashType ?? Transaction.SIGHASH_ALL;
        const serializer = getSerializer(this.#coin);

        if (txIn.witnessUtxo === undefined) Error('Need a Utxo input item for signing');

        const prevout = txIn.witnessUtxo!;
        const { type, scriptPubkey } = this.#fetchInputScript(inputIndex);
        let data;
        switch (type) {
            case ScriptType.P2WPKH:
            case ScriptType.P2SH_P2WPKH:
                logger?.debug(ScriptType[type]);
                // P2WPKH uses the P2PKH template for prevoutScript when signing
                const signingScript = getPayment(this.#coin).p2pkh(this.#coin, { hash: scriptPubkey.slice(2) }).scriptPublickey;
                data = serializer.dataForWitnessV0(
                    unsignedTx,
                    inputIndex,
                    signingScript,
                    prevout.value,
                    sighashType,
                );
                break;

            case ScriptType.P2WSH:
            case ScriptType.P2WSH_P2MS:
                logger?.debug(ScriptType[type]);

                data = serializer.dataForWitnessV0(
                    unsignedTx,
                    inputIndex,
                    txIn.witnessScript!,
                    prevout.value,
                    sighashType,
                );
                break;

            case ScriptType.P2TR:
                logger?.debug("p2tr");

                sighashType = txIn.sighashType ?? Transaction.SIGHASH_DEFAULT;
                data = serializer.dataForWitnessV1(
                    unsignedTx,
                    inputIndex,
                    this.#data.inputs.map((_, i) => this.#fetchInputScript(i).scriptPubkey),
                    this.#data.inputs.map(x => x.witnessUtxo!.value),
                    sighashType
                );
                break;

            default:
                if (this.#coin === CoinType.BITCOINCASH) {
                    logger?.debug("bch using bip143");

                    data = serializer.dataForWitnessV0(
                        unsignedTx,
                        inputIndex,
                        scriptPubkey,
                        prevout.value,
                        sighashType | SIGHASH_FORKID,
                    );
                }
                else {
                    logger?.debug("non-segwit");

                    data = serializer.dataForSignature(
                        unsignedTx,
                        inputIndex,
                        scriptPubkey,
                        sighashType,
                    );
                }
                break;
        }

        return data;
    }

    #extractInput(tx: Transaction, index: number, _: { finalScriptSig?: Buffer, finalScriptWitness?: Buffer }) {
        if (!_.finalScriptSig && !_.finalScriptWitness) throw Error(`input#${index} not finalized.`);

        if (_.finalScriptSig) tx.ins[index].script = _.finalScriptSig;

        if (_.finalScriptWitness) {
            if (this.#fetchInputScript(index).type !== ScriptType.P2TR) {
                tx.ins[index].witness = scriptWitnessToWitnessStack(_.finalScriptWitness);
            }
            else {
                tx.ins[index].witness = [_.finalScriptWitness];
            }
        }
    }

    #estimateVSize(): number {
        const txForFee = this.#tx.clone();

        let scriptSize = 0, witnessSize = 2;
        this.#data.inputs.forEach((txIn, i) => {
            const { type } = this.#fetchInputScript(i);
            scriptSize += getInScriptSize(type);

            const witness = getWitnessSize(type, txIn.sighashType);
            witnessSize += vectorSize(witness);
        });

        return txForFee.virtualSize() + scriptSize + witnessSize / 4;
    }

    #checkDust(throwError: boolean) {
        let error;

        for (let i = 0; i < this.#tx.outs.length; i++) {
            const { script, value } = this.#tx.outs[i];
            if (this.#payment.isArbitraryData(script)) continue;

            const type = this.#payment.isP2SH(script)
                ? ScriptType.P2SH_P2WPKH
                : this.#payment.classify(script);
            const dust = getDustThreshold(type, dustRelayFee);
            const _value = BigNumber(value);

            logger?.debug(`output #${i}\n${this.#payment.encode(this.#coin, script)}\n${_value.toFixed(0)}`);

            if (_value.lt(dust)) {
                logger?.warn(`output #${i}: dust threshold is ${dust}, but got ${_value.toFixed(0)}`);
                if (!error) error = Error("Transaction has output below a certain value (Dust).");
            }
        }

        if (throwError && error) throw error;
    }

    #checkSighashType(input: PsbtInput, type?: ScriptType) {
        if (type === ScriptType.P2TR) return;
        if (!input.sighashType) return;
        if (!input.partialSig) return;

        const { partialSig, sighashType } = input;
        for (const sig of partialSig) {
            const { hashType } = Script.decode(sig.signature);

            if (hashType !== sighashType) throw Error('Signature sighash does not match input sighash type');
        }
    }

    #modifyByFee(feeRate: number, changeIndex: number = 0) {
        const vSize = this.#estimateVSize();
        const estimateFee = Math.round(vSize * feeRate);
        logger?.info(`Estimated fee is ${estimateFee}, with ${feeRate} fee rates.`);

        const total = this.#data.inputs.reduce((a, txIn) => a + txIn.witnessUtxo!.value, 0);
        const spend = this.#tx.outs.reduce((a, txOut) => a + txOut.value, 0);
        const actualFee = total - spend;

        if (actualFee < estimateFee) logger?.warn(`Estimated fee is ${estimateFee}, but got ${actualFee}.`);

        const change = this.#tx.outs[changeIndex].value;
        const modified_change = change + (actualFee - estimateFee);
        this.#tx.outs[changeIndex].value = modified_change;
        logger?.info(`Modify output#${changeIndex} amount from ${change} to ${modified_change}.`);
    }
}


function getMeaningfulScript(
    script: Buffer,
    scriptType: ScriptType,
    redeemScript?: Buffer,
) {
    let meaningfulScript;
    switch (scriptType) {
        case ScriptType.P2SH:
        case ScriptType.P2SH_P2PKH:
        case ScriptType.P2SH_P2WPKH:
        case ScriptType.P2SH_P2MS:
            if (!redeemScript) throw Error("scriptPubkey is P2SH but redeemScript missing");
            meaningfulScript = redeemScript;
            break;

        default:
            meaningfulScript = script;
    }

    if (!meaningfulScript) throw Error("cannot extract script");

    return meaningfulScript;
}

function getScriptFromInput(input: PsbtInput, coin: CoinType) {
    let script: Buffer | undefined;
    let scriptType: ScriptType | undefined;
    const payment = getPayment(coin);


    if (input.witnessScript) {
        script = input.witnessScript;
        scriptType = payment.classify(script);
        switch (scriptType) {
            case ScriptType.P2MS:
                scriptType = ScriptType.P2WSH_P2MS;
                break;

            default:
                throw Error(`unknown script: ${script.toString("hex")}`);
        }
    }
    else if (input.redeemScript) {
        script = input.redeemScript;
        scriptType = payment.classify(script);
        switch (scriptType) {
            case ScriptType.P2PKH:
                scriptType = ScriptType.P2SH_P2PKH;
                break;

            case ScriptType.P2WPKH:
                scriptType = ScriptType.P2SH_P2WPKH;
                break;

            case ScriptType.P2MS:
                scriptType = ScriptType.P2SH_P2MS;
                break;

            default:
                throw Error(`unknown script: ${script.toString("hex")}`);
        }
    }
    else {
        script = input.witnessUtxo!.script;
        scriptType = payment.classify(script);
    }

    return {
        script,
        scriptType
    }
}

function prepareFinalScripts(scriptType: ScriptType, input: PsbtInput) {
    let finalScriptSig;
    let finalScriptWitness;

    const { signature, pubkey } = input.partialSig![0];
    switch (scriptType) {
        case ScriptType.P2PKH:
            finalScriptSig = Script.compile([signature, pubkey]);
            break;

        case ScriptType.P2SH_P2PKH:
            finalScriptSig = (() => {
                const input = Script.compile([signature, pubkey])!;
                const chunks = Script.decompile(input)!;
                const redeem = {
                    output: chunks[chunks.length - 1],
                    input: Script.compile(chunks.slice(0, -1))!
                };

                return Script.compile(
                    ([] as (Buffer | number)[]).concat(
                        Script.decompile(redeem.input),
                        redeem.output
                    )
                );
            })();
            break;

        case ScriptType.P2SH_P2WPKH:
            finalScriptWitness = witnessStackToScriptWitness([signature, pubkey]);
            finalScriptSig = (() => {
                const input = Buffer.alloc(0);
                const hash = Hash160(pubkey);
                const output = Script.compile([OPCODES.OP_0, hash])!;

                return Script.compile(
                    ([] as (Buffer | number)[]).concat(
                        Script.decompile(input),
                        output
                    )
                );
            })();
            break;

        case ScriptType.P2SH_P2MS:
            finalScriptSig = (() => {
                const signatures = getSortedSignatures(input);
                const _input = Script.compile([OPCODES.OP_0 as any].concat(signatures))!;

                return Script.compile(
                    ([] as (Buffer | number)[]).concat(
                        Script.decompile(_input),
                        input.redeemScript!
                    )
                );
            })();
            break;

        case ScriptType.P2WPKH:
            finalScriptWitness = witnessStackToScriptWitness([signature, pubkey]);
            break;

        case ScriptType.P2WSH_P2MS: {
            const signatures = getSortedSignatures(input);
            const scriptSig = Script.toStack([OPCODES.OP_0, ...signatures]);
            finalScriptWitness = witnessStackToScriptWitness([...scriptSig, input.witnessScript!]);
            break;
        }

        case ScriptType.P2TR:
            finalScriptWitness = signature;
            break;
    }

    return {
        finalScriptSig,
        finalScriptWitness
    };
}

function getSortedSignatures(input: PsbtInput) {
    // m {publickeys} n op_checkmultisig
    const chunk = Script.decompile(input.witnessScript ?? input.redeemScript!);
    const m = chunk[0] as number - OPCODES.OP_INT_BASE;
    const sigData = input.partialSig!;
    const signatures: Buffer[] = [];
    const orderedPublickeys = chunk.slice(1, -2) as Buffer[];
    for (const pk of orderedPublickeys) {
        const sig = sigData.find(sig => sig.pubkey.equals(pk));
        if (sig) {
            signatures.push(sig.signature);
        }
    }

    if (signatures.length < m) throw Error(`${m} signatures needed, but got ${sigData.length}`);

    return signatures;
}


class PsbtTransaction {
    #tx: Transaction;

    constructor(buffer = Buffer.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0])) {
        this.#tx = Transaction.fromBuffer(buffer);
    }

    getInputOutputCounts() {
        return {
            inputCount: this.#tx.ins.length,
            outputCount: this.#tx.outs.length,
        };
    }

    addInput(input: PsbtInputExtended) {
        if (
            input.hash === undefined ||
            input.index === undefined ||
            (!Buffer.isBuffer(input.hash) && typeof input.hash !== 'string') ||
            typeof input.index !== 'number'
        ) {
            throw new Error('Error adding input.');
        }
        const hash =
            typeof input.hash === 'string'
                ? Buffer.from(Buffer.from(input.hash, 'hex').reverse())
                : input.hash;
        this.#tx.addInput(hash, input.index, input.sequence);
    }

    addOutput(output: PsbtOutputExtended) {
        if (
            output.script === undefined ||
            output.value === undefined ||
            !Buffer.isBuffer(output.script) ||
            typeof output.value !== 'number'
        ) {
            throw new Error('Error adding output.');
        }
        this.#tx.addOutput(output.script, output.value, output.path);
    }

    toBuffer() {
        return this.#tx.toBuffer();
    }

    get tx() {
        return this.#tx;
    }
}
