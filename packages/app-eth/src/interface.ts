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


import ow from "ow";
import { owTool } from "@secux/utility";
const validate = require("wallet-address-validator").validate;


export type PrefixedHexString = string;
export type JsonString = string;

export const ow_address = ow.string.matches(/^0x[0-9A-fa-f]{40}$/)
    .validate(x => {
        return {
            validator: validate(x, "ETH"),
            message: `ArgumentError: invalid address, got "${x}"`
        }
    });
export const ow_hexString32 = ow.string.matches(/^0x[a-fA-F0-9]{1,64}$/);
export const ow_gasPriceUnit = ow.any(ow.number.uint32.greaterThanOrEqual(1e9), owTool.prefixedhexString);


export interface tx155_base {
    chainId: number | PrefixedHexString,
    nonce: number | PrefixedHexString,
    gasPrice: number | PrefixedHexString,
    gasLimit: number | PrefixedHexString,
    to: string,
    value: number | PrefixedHexString
}

export interface tx1559_base {
    chainId: number | PrefixedHexString,
    nonce: number | PrefixedHexString,
    maxPriorityFeePerGas: number | PrefixedHexString,
    maxFeePerGas: number | PrefixedHexString,
    gasLimit: number | PrefixedHexString,
    to: string,
    value: number | PrefixedHexString,
    accessList?: any[]
}

export interface tx155 extends tx155_base {
    data?: PrefixedHexString
}

export interface tx1559 extends tx1559_base {
    data?: PrefixedHexString
}

export type baseData = tx155_base | tx1559_base;

const __tx155 = {
    chainId: ow.any(ow.number.positive, owTool.prefixedhexString),
    nonce: ow.any(ow.number, owTool.prefixedhexString),
    gasPrice: ow_gasPriceUnit,
    gasLimit: ow.any(ow.number.positive, owTool.prefixedhexString),
    to: ow_address,
    value: ow.any(ow.number.not.negative, owTool.prefixedhexString),
};
export const ow_tx155_base = ow.object.partialShape(__tx155);
export const ow_tx155 = ow.object.exactShape({
    ...__tx155,
    data: ow.any(ow.undefined, owTool.prefixedhexString)
});

const __tx1559 = {
    chainId: ow.any(ow.number.positive, owTool.prefixedhexString),
    nonce: ow.any(ow.number, owTool.prefixedhexString),
    maxPriorityFeePerGas: ow.any(ow.number.uint32.positive, owTool.prefixedhexString),
    maxFeePerGas: ow_gasPriceUnit,
    gasLimit: ow.any(ow.number.positive, owTool.prefixedhexString),
    to: ow_address,
    value: ow.any(ow.undefined, ow.number.not.negative, owTool.prefixedhexString),
    accessList: ow.any(ow.undefined, ow.array.ofType(ow.any()))
};
export const ow_tx1559_base = ow.object.partialShape(__tx1559);
export const ow_tx1559 = ow.object.exactShape({
    ...__tx1559,
    data: ow.any(ow.undefined, owTool.prefixedhexString)
});

export const ow_baseData = ow.any(ow_tx155_base, ow_tx1559_base);

export const ow_EIP712TypedData = ow.object.exactShape({
    name: ow.string,
    type: ow.string
});

export const ow_TypedMessage = ow.object.exactShape({
    types: ow.object.valuesOfType(ow.array.ofType(ow_EIP712TypedData)),
    primaryType: ow.string,
    domain: ow.object.exactShape({
        name: ow.optional.string,
        version: ow.optional.string,
        chainId: ow.optional.number.not.negative,
        verifyingContract: ow.optional.string
    }),
    message: ow.object
});

export function isJsonString(str: string) {
    try {
        JSON.parse(str);
    } catch (error) {
        return false;
    }

    return true;
}