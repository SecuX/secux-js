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


import { BigNumber } from 'bignumber.js';
import ow from 'ow';
import { splitPath } from './BIP32Path';
import { Base58 } from './bs58';
export { buildPathBuffer, decodePathBuffer, splitPath } from "./BIP32Path";
export { toExtenededPublicKey } from "./xpub";
export { Signature } from "./signature";
export const Logger: any = process.env.SECUX_LOGGER;
const logger = Logger?.child({ id: "utility" });

export class owTool {
    static get bip32String() { return ow.string.matches(/^m(\/\d+')+(\/\d+)*$/); }
    static get hexString() { return ow.string.matches(/^[0-9A-F-a-f]+$/); }
    static get prefixedhexString() { return ow.string.matches(/^0x[0-9A-F-a-f]+$/); }
    static get hashString() { return ow.string.matches(/^[0-9A-Z-a-z]+$/); }
    static get numberString() { return ow.string.matches(/^[0-9]+$/); }
    static get xpubString() { return ow.string.matches(/^[1-9A-NP-Za-km-z]{111}$/); }
    static get base58String() { return ow.string.is(x => !!Base58.decodeUnsafe(x)); }
    static get base64String() { return ow.string.matches(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/); }
};

// the instance is shared object (dangerous)
/**
 * @deprecated
 */
export const ow_bip32String = ow.string.matches(/^m(\/\d+')+(\/\d+)*$/);
/**
 * @deprecated
 */
export const ow_hexString = ow.string.matches(/^[0-9A-F-a-f]+$/);
/**
 * @deprecated
 */
export const ow_prefixedhexString = ow.string.matches(/^0x[0-9A-F-a-f]+$/);
/**
 * @deprecated
 */
export const ow_hashString = ow.string.matches(/^[0-9A-Z-a-z]+$/);
/**
 * @deprecated
 */
export const ow_numberString = ow.string.matches(/^[0-9]+$/);
/**
 * @deprecated
 */
export const ow_xpubString = ow.string.matches(/^[1-9A-NP-Za-km-z]{111}$/);
/**
 * @deprecated
 */
export const ow_base58String = ow.string.is(x => !!Base58.decodeUnsafe(x));


export function ow_strictPath(coinType: number | Array<number>, purpose?: number | Array<number>) {
    const coins = numbersToRegExp((typeof coinType === "number") ? [coinType] : coinType);

    if (purpose) {
        const purposes = numbersToRegExp((typeof purpose === "number") ? [purpose] : purpose);
        return ow.string.matches(new RegExp(`^m/${purposes}'/${coins}'/[0-9]+'/[0-9]+/[0-9]+$`));
    }

    return ow.string.matches(new RegExp(`^m/[0-9]+'/${coins}'/[0-9]+'/[0-9]+/[0-9]+$`));
}

export function ow_accountPath(coinType: number | Array<number>, purpose?: number | Array<number>) {
    const coins = numbersToRegExp((typeof coinType === "number") ? [coinType] : coinType);

    if (purpose) {
        const purposes = numbersToRegExp((typeof purpose === "number") ? [purpose] : purpose);
        return ow.string.matches(new RegExp(`^m/${purposes}'/${coins}'/[0-9]+'`));
    }

    return ow.string.matches(new RegExp(`^m/[0-9]+'/${coins}'/[0-9]+'`));
}

export function ow_checkBufferLength(length: number) {
    return ow.buffer.validate(value => ({
        validator: value.length === length,
        message: label => `ArgumentError: Expected length of ${label} is ${length}, got ${value.length}`
    }));
}

export function BigIntToBuffer(value: number | string, bufferlen: number, isLE: boolean = true) {
    let hex = "";
    if (typeof value === "number") {
        hex = value.toString(16);
    }
    else if (typeof value === "string") {
        hex = new BigNumber(value).toString(16);
    }

    if (hex.length % 2 !== 0) hex = '0' + hex;

    const tmp = Buffer.from(hex, "hex");
    if (tmp.length > bufferlen) throw Error("value is too large");

    const buf = Buffer.concat([
        Buffer.alloc(bufferlen - tmp.length),
        tmp
    ]);

    if (isLE) {
        return buf.reverse();
    }
    else {
        return buf;
    }
}

export const supported_coin = Object.freeze([
    { purpose: [44, 49, 84, 86], cointype: 0, name: "bitcoin mainnet", module: "SecuxBTC", npm: "@secux/app-btc" },
    { purpose: [44, 49, 84, 86], cointype: 1, name: "bitcoin testnet", module: "SecuxBTC", npm: "@secux/app-btc" },
    { purpose: [44, 49], cointype: 2, name: "litecoin", module: "SecuxBTC", npm: "@secux/app-btc" },
    { purpose: [44], cointype: 3, name: "dogecoin", module: "SecuxBTC", npm: "@secux/app-btc" },
    { purpose: [44], cointype: 5, name: "dash", module: "SecuxBTC", npm: "@secux/app-btc" },
    { purpose: [44, 49], cointype: 17, name: "groestl", module: "SecuxBTC", npm: "@secux/app-btc" },
    { purpose: [44, 49], cointype: 20, name: "digibyte", module: "SecuxBTC", npm: "@secux/app-btc" },
    { purpose: [44], cointype: 60, name: "ethereum", module: "SecuxETH", npm: "@secux/app-eth" },
    { purpose: [44], cointype: 144, name: "ripple", module: "SecuxXRP", npm: "@secux/app-xrp" },
    { purpose: [44, 49], cointype: 145, name: "bitcoincash", module: "SecuxBTC", npm: "@secux/app-btc" },
    { purpose: [44], cointype: 148, name: "stellar", module: "SecuxXLM", npm: "@secux/app-xlm" },
    { purpose: [44], cointype: 195, name: "tron", module: "SecuxTRX", npm: "@secux/app-trx" },
    { purpose: [44], cointype: 714, name: "binance", module: "SecuxBNB", npm: "@secux/app-bnb" },
    { purpose: [1852], cointype: 1815, name: "cardano", module: "SecuxADA", npm: "@secux/app-ada" },
    { purpose: [44], cointype: 501, name: "solana", module: "SecuxSOL", npm: "@secux/app-sol" },
    { purpose: [44], cointype: 330, name: "terra", module: "SecuxLUNA", npm: "@secux/app-luna" },
    { purpose: [44], cointype: 235, name: "fioprotocol", module: "SecuxFIO", npm: "@secux/app-fio" },
]);

export function isSupportedCoin(path: string): boolean {
    const bip32 = splitPath(path);

    for (const def of supported_coin) {
        if (def.purpose.includes(bip32.purpose!.value) &&
            def.cointype === bip32.coinType!.value)
            return true;
    }

    return false;
}

export function loadPlugin(plugin: Function, name: string) {
    try {
        const { ITransport } = require("@secux/transport");

        //@ts-ignore
        if (ITransport[name] === undefined) {
            Object.defineProperty(ITransport, name, {
                enumerable: true,
                configurable: false,
                writable: false,
                value: plugin
            });
        }
    } catch (error) {
        logger?.debug("The package @secux/transport is not at environment, plugin loading skipped");
    }
}

export function checkFWVersion(type: string, restrict: string, current: string) {
    if (!restrict || !current) return;

    const r = restrict.split('.').map(x => parseInt(x));
    const c = current.split('.').map(x => parseInt(x));

    for (let i = 0; i < restrict.length; i++) {
        const _r = r[i], _c = c[i];
        if (_r < _c) return;
        if (_r > _c) throw Error(`${type} firmware need update, version "${restrict}" needed, but got "${current}"`);
    }
}

function numbersToRegExp(list: Array<number>): string {
    let a = "";
    list.map(c => a = a + `${c.toString()}|`);
    a = `(${a.substring(0, a.length - 1)})`;

    return a;
}

if (!process.env.SECUX_LOGGER) {
    Object.defineProperty(process.env, "SECUX_LOGGER", {
        enumerable: false,
        configurable: false,
        writable: false,
        value: undefined
    });
}