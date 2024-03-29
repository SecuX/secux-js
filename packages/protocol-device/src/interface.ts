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
import { ITransport } from "@secux/transport";

export const ow_AccountPath = ow.string.matches(/^m(\/\d+'){3}/);
const ow_accountName = ow.string.matches(/^[a-zA-Z0-9._-]+(\s+[a-zA-Z0-9._-]+)*$/).maxLength(16);
export const ow_chainId = ow.any(ow.number.not.negative, owTool.numberString, owTool.prefixedhexString);

export interface ITransportNordic extends ITransport {
    WritePacket(data: Buffer): Promise<void>;
}

export type VersionInfo = {
    transportVersion: number,
    seFwVersion: string,
    mcuFwVersion: string,
    bootloaderVersion: string,
    model?: string,
    customerId?: string,
    deviceId?: string,
}

export enum ModelID {
    W10 = 0x00570A00,
    W20 = 0x00571400,
    V20 = 0x00561400,
    T20 = 0x00541400,
    T20X = 0x00541401,
    C20 = 0x00431400,
}

// bitwise configuration [6][5][4][3][2][1][0]
// [0]: wait for activation
// [1]: activated
// [4]: SEED_0 from raw seed
// [5]: SEED_0 from mnemonic
// [6]: SEED_1
export enum WalletStatus {
    NO_SEED = 0,
    LOGOUT = 1,
    NORMAL_RAW = 18,
    NORMAL = 34,
    HIDDEN = 98
}

export type WalletInfo = {
    walletIndex: number,
    walletName: string,
    walletStatus: WalletStatus
}

export enum SEMode {
    NORMAL = 2,
    HIDDEN = 3,
    LOGOUT = 7
}

export type SEINFO = {
    mode: SEMode,
    state: number
}

export type AddressOption = {
    needToConfirm?: boolean,
    chainId?: number
}

export const ow_AddressOption = ow.object.exactShape({
    needToConfirm: ow.optional.boolean,
    chainId: ow.any(ow.undefined, ow_chainId)
});

export type StatusCallback = (status: number) => void;

export type AccountInfo = {
    name: string,
    path: string,
    chainId: number | string | undefined,
    balance: string,
    symbol: string,
    contract?: string,
    decimal?: number,
}

export const ow_AccountNormal = ow.object.partialShape({
    name: ow_accountName,
    path: ow_AccountPath,
    chainId: ow.any(ow.undefined, ow_chainId),
    balance: ow.any(owTool.numberString, owTool.prefixedhexString),
    symbol: ow.string.nonEmpty,
    decimal: ow.number.uint8,
});

export const ow_AccountToken = ow.object.partialShape({
    name: ow_accountName,
    path: ow_AccountPath,
    chainId: ow.any(ow.undefined, ow_chainId),
    balance: ow.any(owTool.numberString, owTool.prefixedhexString),
    symbol: ow.string.nonEmpty,
    contract: owTool.hashString,
    decimal: ow.number.uint8,
});

export type DeleteOption = {
    contract?: string,
    chainId: number | string
};

export const ow_DeleteOption = ow.object.exactShape({
    contract: ow.any(ow.undefined, owTool.hashString),
    chainId: ow_chainId
});

export enum FileMode {
    ADD,
    REMOVE,
    READ,
    __LENGTH
}
export const ow_FileMode = ow.number.inRange(0, FileMode.__LENGTH);

export enum FileDestination {
    SDCARD,
    LOGO,
    CONFIRM,
    GALLERY,
    __LENGTH
}
export const ow_FileDestination = ow.number.inRange(0, FileDestination.__LENGTH);

export enum FileType {
    png,
    bpp1,
    bpp2,
    bpp4,
    wav,
    jpg,
    hlt,
    __LENGTH
}
export const ow_FileType = ow.number.inRange(0, FileType.__LENGTH);

export enum AttachmentType {
    Bitcoin,
    Ethereum,
    Polygon,
    Solana,
    BSC,
    Agence,
    __LENGTH
}
export const ow_AttachmentType = ow.number.inRange(0, AttachmentType.__LENGTH);

export const AttachmentExt = Object.freeze({
    [AttachmentType.Bitcoin]: "btc",
    [AttachmentType.Ethereum]: "eth",
    [AttachmentType.Polygon]: "plg",
    [AttachmentType.Solana]: "sol",
    [AttachmentType.BSC]: "bsc",
    [AttachmentType.Agence]: "hme",
});

export enum ContentKey {
    tokenId = 1,
    contractAddress,
    uri,
    assetName,
    collectionName,
    tokenStandard
}

export type FileAttachment = {
    type: AttachmentType,
    contractAddress: string,
    tokenId: string,
    uri?: string,
    assetName: string,
    collectionName: string,
    tokenStandard: string
}
const ow_KeyValue = ow.string.nonEmpty.is(value => Buffer.from(value, "utf8").length <= 2047);
export const ow_FileAttachment = ow.object.exactShape({
    type: ow_AttachmentType,
    contractAddress: ow_KeyValue,
    tokenId: ow_KeyValue,
    uri: ow.any(ow.undefined, ow_KeyValue),
    assetName: ow_KeyValue,
    collectionName: ow_KeyValue,
    tokenStandard: ow_KeyValue,
});

export type FileInfo = {
    size: number,
    destination: FileDestination,
    type: FileType,
    name: string,
    attachment?: FileAttachment
}
export const ow_filename = ow.string.nonEmpty.is(f => Buffer.from(f, "utf8").length <= 47);
export const ow_FileInfo = ow.object.exactShape({
    size: ow.number.uint32,
    destination: ow_FileDestination,
    type: ow_FileType,
    name: ow.any(ow.string.empty, ow_filename),
    attachment: ow.any(ow.undefined, ow_FileAttachment)
});