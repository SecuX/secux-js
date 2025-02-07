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


import { owTool, ow_checkBufferLength, ow_strictPath } from "@secux/utility";
import { isAddress, isPool, isShelleyAddress } from "./utils";
import ow from "ow";


export const ow_xpublickey = ow.any(ow.string.matches(/^[0-9A-F-a-f]{128}$/), ow_checkBufferLength(64));
export const ow_path = ow.string.matches(/^m\/1852'\/1815'\/\d+'$/);
export const ow_fullPath = ow_strictPath(1815, 1852);
export const ow_address = ow.string.is(x => isAddress(x) ? true
    : `ArgumentError: unsupported address, got ${x}`);
export const ow_shelleyAddress = ow.string.is(x => isShelleyAddress(x) ? true
    : `ArgumentError: support shelley address only, but got ${x}`);
export const ow_poolHash = ow.string.is(x => isPool(x) ? true
    : `ArgumentError: invalid pool hash, got ${x}`);


export type PublickeyOption = {
    change: number,
    addressIndex: number
};

const txId = ow.string.matches(/^[0-9A-Fa-f]{64}$/);
const index = ow.number.uint8;
const amount = ow.any(ow.number.uint32.positive, owTool.numberString);
const addressIndex = ow.optional.number.uint8;
const stakeIndex = ow.optional.number.uint8;
export const ow_PublickeyOption = ow.object.exactShape({
    change: ow.number.uint8,
    addressIndex
});

export enum AddressType {
    // shelley
    BASE,
    ENTERPRISE,
    POINTER,
    REWARD,

    // byron
    BOOTSTRAPv1,
    BOOTSTRAPv2,

    __LENGTH
}

export const NetworkInfo = Object.freeze({
    mainnet: {
        id: 1,
        protocol: 764824073
    },
    preview: {
        id: 0,
        protocol: 2
    },
    preprod: {
        id: 0,
        protocol: 1
    }
});

export type PointerOption = {
    slot: number,
    txIndex: number,
    certIndex: number
};

export const ow_PointerOption = ow.object.exactShape({
    slot: ow.number.uint32,
    txIndex: ow.number.uint32,
    certIndex: ow.number.uint32
});

export type AddressOption = {
    addressIndex?: number,
    stakeIndex?: number,
    pointer?: PointerOption,
    network?: typeof NetworkInfo.mainnet
};

export const ow_AddressOption = ow.object.partialShape({
    addressIndex,
    stakeIndex
});

export type TxInput = {
    path: string,
    txId: string,
    index: number,
    amount: number | string,
    xpublickey?: string | Buffer,
    addressIndex?: number,
    stakeIndex?: number
};

export const ow_TxInput = ow.object.exactShape({
    path: ow_path,
    txId,
    index,
    amount,
    xpublickey: ow_xpublickey,
    addressIndex,
    stakeIndex
});

export type TxOutput = {
    address: string,
    amount: number | string
};

export const ow_TxOutput = ow.object.exactShape({
    address: ow_address,
    amount
});

export type StakeInput = {
    path: string,
    utxo: Array<{
        txId: string,
        index: number,
        amount: number | string,
        addressIndex?: number
    }>,
    changeAddress: string,
    xpublickey?: string | Buffer,
    stakeIndex?: number
}

export const ow_StakeInput = ow.object.exactShape({
    path: ow_path,
    utxo: ow.array.ofType(ow.object.exactShape({
        txId,
        index,
        amount,
        addressIndex
    })),
    changeAddress: ow_shelleyAddress,
    xpublickey: ow_xpublickey,
    stakeIndex
});

interface BaseOption {
    fee?: number | string;
    TimeToLive?: number;
}

const ow_BaseOption = {
    fee: ow.any(ow.undefined, ow.number.uint32.positive, owTool.numberString),
    TimeToLive: ow.optional.number.uint32.positive
};

export interface SignOption extends BaseOption {
    changeAddress?: string;
}

export const ow_SignOption = ow.object.exactShape({
    changeAddress: ow.any(ow.undefined, ow_shelleyAddress),
    ...ow_BaseOption
});

export interface StakeOption extends BaseOption {
    stakeIndex?: number;
    needRegistration?: boolean;
}

export const ow_StakeOption = ow.object.exactShape({
    stakeIndex,
    needRegistration: ow.optional.boolean,
    ...ow_BaseOption
});

export interface UnStakeOption extends BaseOption {
    stakeIndex?: number;
    withdrawAmount?: number | string;
    network?: typeof NetworkInfo.mainnet;
}

export const ow_UnStakeOption = ow.object.exactShape({
    stakeIndex,
    withdrawAmount: ow.any(ow.undefined, ow.number.uint32.positive, owTool.numberString),
    network: ow.optional.object,
    ...ow_BaseOption
});

export interface WithdrawOption extends BaseOption {
    stakeIndex?: number;
    network?: typeof NetworkInfo.mainnet;
}

export const ow_WithdrawOption = ow.object.exactShape({
    stakeIndex,
    network: ow.optional.object,
    ...ow_BaseOption
});

export enum DrepType {
    ABSTAIN,
    NO,

    __LENGTH
}
