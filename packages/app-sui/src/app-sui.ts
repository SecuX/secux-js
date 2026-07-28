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

import "./polyfill";
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { fromHex, toBase64 } from '@mysten/sui/utils';
import { PublicKey, SignatureScheme, toSerializedSignature } from '@mysten/sui/cryptography';
import { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';
import ow from "ow";
import * as secp256k1 from "secp256k1";
import { ITransport } from "@secux/transport";
import {
  communicationData,
  getBuffer,
  ow_communicationData,
  toCommunicationData,
  wrapResult,
} from "@secux/utility/lib/communication";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve, TransactionType } from "@secux/protocol-transaction/lib/interface";
import {
  loadPlugin,
  Logger,
} from "@secux/utility";
import { ow_nftData, ow_path, ow_publickey, ow_tokenData, ow_TransactionObject, ow_transferData, SuiCurve, TransactionObject, txDetail } from "./interface";

export { SecuxSUI };
const logger = Logger?.child({ id: "sui" });
const coinTransferTarget = '0x2::transfer::public_transfer';

/**
 * SUI package for SecuX device
 */
class SecuxSUI {
  /**
   * Convert bip32-publickey to SUI address.
   * @param {string|Buffer} publickey ada bip32-publickey
   * @param {EllipticCurve} curve
   * @returns {string} address
   */
  static addressConvert(
    publickey: string | Buffer,
    curve: SuiCurve = EllipticCurve.ED25519
  ): string {
    ow(publickey, ow_publickey);
    const suiPublicKey = suiPublickeyFromCurve(publickey, curve);
    return suiPublicKey.toSuiAddress();
  }

  /**
   * Prepare data for address generation.
   * @param {string} path m/1852'/1815'/...
   * @returns {communicationData} data for sending to device
   */
  static prepareAddress(path: string, curve: SuiCurve = EllipticCurve.ED25519) {
    return this.preparePublickey(path, curve);
  }

  /**
   * Resolve address from response data.
   * @param {communicationData} response data from device
   * @param {SuiCurve} curve
   * @returns {string} address
   */
  static resolveAddress(response: communicationData, curve: SuiCurve = EllipticCurve.ED25519) {
    const pk = this.resolvePublickey(response, curve);
    return this.addressConvert(pk, curve);
  }

  /**
   * Prepare data for ed25519 publickey.
   * @param {string} path BIP32 path (hardened child key), ex: m/44'/784'/0'/0'/0'
   * @returns {communicationData} data for sending to device
   */
  static preparePublickey(path: string, curve: SuiCurve = EllipticCurve.ED25519): communicationData {
    ow(path, ow_path);
    return SecuxTransactionTool.getPublickey(path, curve);
  }

  /**
   * Resove ed25519 publickey from response data.
   * @param {communicationData} response data from device
   * @returns {string} ed25519 publickey (hex string)
   */
  static resolvePublickey(response: communicationData, curve: SuiCurve = EllipticCurve.ED25519): string {
    const pk_64 = SecuxTransactionTool.resolvePublickey(response, curve);
    const pk = Buffer.from(pk_64, "base64");

    return pk.toString("hex");
  }

  /**
   * Prepare data for signing.
   * @param {string} path m/44'/195'/...
   * @param {transferData} content transaction object
   * @returns {prepared} prepared object
   */
  static async prepareSign(
    path: string,
    content: txDetail
  ): Promise<{ commandData: communicationData; rawTx: communicationData }> {
    ow(path, ow_path);
    const curve = curveFromPath(path);
    const tx = new Transaction();
    tx.setSender(SecuxSUI.addressConvert(content.publickey, curve));
    tx.setGasPrice(Number(content.gasPrice));
    tx.setGasBudget(Number(content.gasBudget));

    tx.setGasPayment(content.gasPayment.map(ref => ({
      objectId: ref.objectId,
      version: String(ref.version),
      digest: ref.digest
    })));

    let transferObjects: TransactionObjectArgument[] = [];

    if (content.tokens) {
      ow(content, ow_tokenData);
      // Send Custom Token: Merge objects if needed, then split
      const primaryToken = tx.objectRef({
        objectId: content.tokens[0].objectId,
        version: String(content.tokens[0].version),
        digest: content.tokens[0].digest
      });

      const tokensToMerge = content.tokens.slice(1).map(ref => tx.objectRef({
        objectId: ref.objectId,
        version: String(ref.version),
        digest: ref.digest
      }));
      if (tokensToMerge.length > 0) {
        tx.mergeCoins(primaryToken, tokensToMerge);
      }

      const [token] = tx.splitCoins(primaryToken,[tx.pure.u64(content.amount)]);
      transferObjects = [token];
      tx.moveCall({
        target: coinTransferTarget,
        typeArguments: [ content.type.startsWith('0x2::coin::Coin') ? content.type : `0x2::coin::Coin<${content.type}>` ],
        arguments: [
          token,
          tx.pure.address(content.to)
        ],
      });
    } else if (content.nfts) {
      ow(content, ow_nftData);
      // Send NFTs: Transfer all specified objects directly
      transferObjects = content.nfts.map(ref => tx.objectRef({
        objectId: ref.objectId,
        version: String(ref.version),
        digest: ref.digest
      }));
      tx.transferObjects(transferObjects, content.to);
    } else {
      ow(content, ow_transferData);
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(content.amount!)]);
      transferObjects = [coin];
      tx.transferObjects(transferObjects, content.to);
    }

    const txBytes = await tx.build();

    const intentMessage = new Uint8Array([0, 0, 0].length + txBytes.length);
    intentMessage.set([0, 0, 0]);
    intentMessage.set(txBytes, 3);

    return wrapResult({
      commandData: SecuxTransactionTool.signRawTransaction(
        path,
        Buffer.from(intentMessage),
        {
          tp: TransactionType.NORMAL,
          curve: curve,
          chainId: 0
        }),
      rawTx: toCommunicationData(Buffer.from(txBytes)),
    });
  }

  /**
   * Reslove signatures from response data.
   * @param {communicationData} response data from device
   * @returns {string} signature (base64 encoded)
   */
  static resolveSignature(response: communicationData): string {
    const sig = Buffer.from(SecuxTransactionTool.resolveSignature(response), "base64");
    return sig.slice(0, -1).toString("hex");
  }

  /**
   * Resolve transaction for broadcasting.
   * @param {communicationData} response data from device
   * @param {TransactionObject} params raw transaction
   * @returns {string} signed raw transaction
   */
  static resolveTransaction(
    response: communicationData,
    params: TransactionObject
  ) {
    ow(response, ow.any(ow_communicationData, ow.array.ofType(ow_communicationData)));
    ow(params, ow_TransactionObject);

    const signature = SecuxSUI.resolveSignature(response);

    const rawSignature = convertToUin8Array(signature);
    const txBytes = convertToUin8Array(getBuffer(params.rawTx));

    // 1. 根據曲線類型建立對應的公鑰物件與 Scheme
    const suiPublicKey = suiPublickeyFromCurve(params.publickey, params.curve);
    let scheme: SignatureScheme;

    switch (params.curve) {
      // case EllipticCurve.SECP256R1:
      //   scheme = 'Secp256r1';
      //   break;
      case EllipticCurve.SECP256K1:
        scheme = 'Secp256k1';
        break;
      case EllipticCurve.ED25519:
      default:
        scheme = 'ED25519';
        break;
    }

    // 2. 封裝 Serialized Signature
    const serializedSig = toSerializedSignature({
      signature: rawSignature,
      signatureScheme: scheme, // SDK 會根據這個字串自動填入正確的 Flag (0x00 或 0x01)
      publicKey: suiPublicKey,
    });

    return wrapResult({
      bytes: toBase64(txBytes),
      signature: serializedSig
    });
  }

  static async getAddress(this: ITransport, path: string) {
    const curve = curveFromPath(path);
    const data = SecuxSUI.prepareAddress(path, curve);
    const rsp = await this.Exchange(getBuffer(data));
    const address = SecuxSUI.resolveAddress(rsp, curve);

    return address;
  }

  static async getPublickey(this: ITransport, path: string) {
    const curve = curveFromPath(path);
    const data = SecuxSUI.preparePublickey(path, curve);
    const rsp = await this.Exchange(getBuffer(data));
    const pk = SecuxSUI.resolvePublickey(rsp, curve);

    return pk;
  }

  static async sign(this: ITransport, path: string, content: txDetail) {
    ow(path, ow_path);

    content.curve = curveFromPath(path);

    // if (!content.from)
    //   content.from = await SecuxSUI.getAddress.call(this, path);
    const { commandData, rawTx } = await SecuxSUI.prepareSign(path, content);
    const rsp = await this.Exchange(getBuffer(commandData));

    return SecuxSUI.resolveTransaction(rsp, {
      rawTx: rawTx,
      curve: content.curve,
      publickey: content.publickey,
    });
  }
}

loadPlugin(SecuxSUI, "SecuxSUI");

function convertToUin8Array(data: string | Buffer) {
  if (typeof data === "string") {
    // fromHex 會自動處理 0x 前綴
    return fromHex(data);
  }
  // 如果已經是 Uint8Array 或 Buffer，確保它是 Uint8Array 格式
  return new Uint8Array(data);
}

function curveFromPath(path: string) {
  let curve: EllipticCurve;
  if (path.startsWith("m/44'")) {
    curve = EllipticCurve.ED25519;
  } else if (path.startsWith("m/54'")) {
    curve = EllipticCurve.SECP256K1;
  }
  //  else if(path.startsWith("m/74'")) {
  //   curve = EllipticCurve.SECP256R1;
  // }
  else {
    throw Error(`ArgumentError: expect path from are m/44' or m/54', but got ${path}`);
  }
  return curve;
}

function suiPublickeyFromCurve(publickey: string | Buffer, curve: EllipticCurve) {
  const rawBytes = convertToUin8Array(publickey);
  let publicKey: PublicKey;
  switch (curve) {
    // case EllipticCurve.SECP256R1:
    //   publicKey = new Secp256r1PublicKey(rawBytes);
    //   break;
    case EllipticCurve.SECP256K1:
      let bytes = rawBytes;
      if (bytes.length === 64 || bytes.length === 65) {
        bytes = Buffer.from(secp256k1.publicKeyConvert(bytes, true));
      }
      publicKey = new Secp256k1PublicKey(bytes);
      break;
    case EllipticCurve.ED25519:
    default:
      publicKey = new Ed25519PublicKey(rawBytes);
      break;
  }
  return publicKey;
}

/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * The payment object.
 * @typedef {object} transferData
 * @property {string} from sending address
 * @property {string} to receiving address
 * @property {number} amount transfer amount
 * @property {string} blockID
 * @property {number} blockNumber
 * @property {number} timestamp
 * @property {number} [feeLimit]
 * @property {number} [expiration]
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {communicationData} commandData data for sending to device
 * @property {communicationData} rawTx unsigned raw transaction
 */
