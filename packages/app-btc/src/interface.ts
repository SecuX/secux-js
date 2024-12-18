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


import ow from 'ow';
import { BigNumber } from "bignumber.js";
import * as constants from "./coindef";
import * as utils from "@secux/utility";
export { OPCODES } from "./coindef";


export enum ScriptType {
    P2PKH,
    P2WPKH,
    P2SH_P2PKH,
    P2SH_P2WPKH,
    P2TR,
    P2WSH,
    __LENGTH
}

export enum CoinType {
    BITCOIN,
    TESTNET,
    REGTEST,
    LITECOIN,
    BITCOINCASH,
    GROESTL,
    DIGIBYTE,
    DASH,
    DOGECOIN,
    __LENGTH
}

// must match above CoinType define
export const coinmap = Object.freeze(
    Object.values(CoinType).slice(0, CoinType.__LENGTH)
        //@ts-ignore
        .map(x => constants[x.toLowerCase()])
);

export const btcCoinTypes = Object.freeze(coinmap.map(x => Object.freeze(x.coinType)));
export const btcPurposes = Object.freeze([
    Object.freeze(44),
    Object.freeze(49),
    Object.freeze(84),
    Object.freeze(86)
]);

export const ow_balance = ow.any(ow.number.integer.positive, utils.owTool.numberString);

//@ts-ignore
export const ow_path = utils.ow_strictPath(btcCoinTypes, btcPurposes);
//@ts-ignore
export const ow_accountPath = utils.ow_accountPath(btcCoinTypes, btcPurposes);
export const ow_hexString = utils.owTool.hexString;
export const ow_hashString = utils.owTool.hashString;

export type PathObject = {
    coin: CoinType,
    script: ScriptType
}

export const ow_PathObject = ow.object.exactShape({
    coin: ow.number.inRange(0, CoinType.__LENGTH - 1),
    script: ow.number.inRange(0, ScriptType.__LENGTH - 1),
});

export type txInput = {
    hash: string,
    vout: number,
    txHex?: string,
    script?: ScriptType,
    satoshis: number | string,
    path: string,
    publickey?: string | Buffer
};

export const ow_txInput = ow.object.exactShape({
    hash: ow_hashString,
    vout: ow.number.greaterThanOrEqual(0),
    txHex: ow.any(ow.undefined, ow_hexString),
    script: ow.optional.number.inRange(0, ScriptType.__LENGTH - 1),
    satoshis: ow_balance,
    path: ow_path,
    publickey: ow.any(ow.undefined, ow_hexString, ow.buffer)
});

export type txOutputAddress = {
    address: string,
    satoshis: number | string
};

export const ow_txOutputAddress = ow.object.exactShape({
    address: ow_hashString,
    satoshis: ow_balance
});

export type txOutputScript = {
    scriptHex: string,
    satoshis: number | string
}

export const ow_txOutputScript = ow.object.exactShape({
    scriptHex: ow_hexString,
    satoshis: ow_balance
});

export type txOutputScriptExtened = {
    publickey?: string | Buffer,
    path: string,
    satoshis: number | string,
    script?: ScriptType
}

export const ow_txOutputScriptExtened = ow.object.exactShape({
    publickey: ow.any(ow.undefined, ow_hexString, ow.buffer),
    path: ow_path,
    satoshis: ow_balance,
    script: ow.optional.number.inRange(0, ScriptType.__LENGTH - 1)
});

export type txOutput = {
    to: txOutputAddress | txOutputScriptExtened,
    utxo?: txOutputScriptExtened
};

export const ow_txOutput = ow.object.exactShape({
    to: ow.any(ow_txOutputAddress, ow_txOutputScriptExtened),
    utxo: ow.any(ow.undefined, ow_txOutputScriptExtened)
});

export type txOutputExtended = txOutputAddress | txOutputScript | txOutputScriptExtened;

export function isOutputAddress(output: txOutputExtended): txOutputAddress | undefined {
    const out = output as txOutputAddress;
    if (out.address) return out;
}

export function isOutuptScript(output: txOutputExtended): txOutputScript | undefined {
    const out = output as txOutputScript;
    if (out.scriptHex) return out;
}

export function isOutuptScriptExtended(output: txOutputExtended): txOutputScriptExtened | undefined {
    try {
        ow(output, ow_txOutputScriptExtened);

        return output;
    } catch (error) { }
}

export type TransactionObject = {
    rawTx: string,
    publickeys: Array<string | Buffer>,
    coin?: CoinType,
};

export const ow_TransactionObject = ow.object.partialShape({
    rawTx: ow_hexString,
    publickeys: ow.array.ofType(ow.any(ow_hexString, ow.buffer)),
    coin: ow.optional.number.inRange(0, CoinType.__LENGTH - 1)
});

export type AddressOption = {
    coin?: CoinType,
    script?: ScriptType
};

export type SignOption = {
    coin?: CoinType,
    feeRate?: number,
    isRBF?: boolean,
    xpub?: string,
}

export const ow_AddressOption = ow.object.exactShape({
    coin: ow.optional.number.inRange(0, CoinType.__LENGTH - 1),
    script: ow.optional.number.inRange(0, ScriptType.__LENGTH - 1),
});

export const ow_SignOption = ow.object.partialShape({
    coin: ow.optional.number.inRange(0, CoinType.__LENGTH - 1),
    feeRate: ow.optional.number.greaterThanOrEqual(1),
    isRBF: ow.optional.boolean,
});