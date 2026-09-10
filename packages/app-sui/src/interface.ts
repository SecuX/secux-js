/*!
Copyright 2022 SecuX Technology Inc
Copyright Chang Chia-Yu

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

import { owTool, ow_checkBufferLength, ow_hardenedPath, ow_strictPath } from "@secux/utility";
import ow from "ow";
import { isAddress, isObjectId, isValidCoinType } from "./utils";
import { EllipticCurve, ow_EllipticCurve } from "@secux/protocol-transaction/lib/interface";
import { communicationData, ow_communicationData } from "@secux/utility/lib/communication";

export const ow_xpublickey = ow.any(
  ow.string.matches(/^[0-9A-F-a-f]{128}$/),
  ow_checkBufferLength(64)
);
export const ow_publickey = ow.any(
  owTool.hexString.length(64),
  ow_checkBufferLength(32),
  owTool.hexString.length(66),
  ow_checkBufferLength(33),
);
export const ow_path = ow.any(
  ow_hardenedPath(784, [44]),
  ow_strictPath(784, [54, 74])
);
export const ow_fullPath = ow_path;
export const ow_address = ow.string.is(x => isAddress(x) ? true
  : `ArgumentError: unsupported address, got ${x}`);
export const ow_objectId = ow.string.is(x => isObjectId(x) ? true
  : `ArgumentError: unsupported object id, got ${x}`);
export const ow_type = ow.string.is(x => isValidCoinType(x) ? true
  : `ArgumentError: unsupported type, got ${x}`);

/**
 * SUI supported elliptic curves
 * - ED25519: for m/44' paths
 * - SECP256K1: for m/54' paths
 */
export type SuiCurve = EllipticCurve.ED25519 | EllipticCurve.SECP256K1;

export type PublickeyOption = {
  change: number;
  addressIndex: number;
};

export type suiObjectRef = {
  objectId: string;
  version: number | string;
  digest: string;
};

export type suiTransactionExpiration =
  | { None: true }
  | { Epoch: number | string }
  | {
      ValidDuring: {
        minEpoch: number | string | null;
        maxEpoch: number | string | null;
        minTimestamp: number | string | null;
        maxTimestamp: number | string | null;
        chain: string;
        nonce: number;
      };
    };

export type txDetail = {
  gasPrice: number | string,
  gasBudget: number | string,
  gasPayment?: suiObjectRef[],
  gasOwner?: string,
  /** BCS TransactionKind resolved by an online @mysten/sui client. */
  transactionKind?: communicationData,
  expiration?: suiTransactionExpiration,
  to: string,
  publickey: string,
  curve?: number,
  amount?: number | string,
  type?: string,
  tokens?: suiObjectRef[],
  nfts?: suiObjectRef[],
  nonce?: string
};

const price = ow.any(ow.number.uint32.positive, owTool.numberString);
const amount = ow.any(ow.number, ow.string);

const ow_suiObjectRef = ow.object.exactShape({
  objectId: ow_objectId,
  version: ow.any(ow.number, ow.string),
  digest: ow.string
});

const base_Data_shape = {
  gasPrice: price,
  gasBudget: amount,
  gasPayment: ow.any(ow.undefined, ow.array.ofType(ow_suiObjectRef)),
  gasOwner: ow.any(ow.undefined, ow_address),
  transactionKind: ow.any(ow.undefined, ow_communicationData),
  expiration: ow.any(ow.undefined, ow.object),
  to: ow_address,
  publickey: ow_publickey,
  curve: ow.any(ow.undefined, ow_EllipticCurve),
  nonce: ow.any(ow.undefined, ow.string),
  tokens: ow.any(ow.undefined, ow.array.ofType(ow_suiObjectRef).nonEmpty),
};

export const ow_base_Data = ow.object.exactShape(base_Data_shape);

export const ow_transferData = ow.object.exactShape({
  ...base_Data_shape,
  amount: amount,
});

export const ow_fungibleData = ow.object.exactShape({
  ...base_Data_shape,
  amount: amount,
  type: ow.any(ow.undefined, ow_type),
});

export const ow_objectFungibleData = ow_fungibleData;

export const ow_nftData = ow.object.exactShape({
  ...base_Data_shape,
  type: ow_type,
  nfts: ow.array.ofType(ow_suiObjectRef).nonEmpty,
});

export type TransactionObject = {
  rawTx: communicationData,
  publickey: string,
  curve: number,
};

export const ow_TransactionObject = ow.object.partialShape({
  rawTx: ow_communicationData,
  publickey: owTool.hexString,
  curve: ow_EllipticCurve,
});
