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
import { fromBase64, fromHex, normalizeStructTag, normalizeSuiAddress, toBase64 } from '@mysten/sui/utils';
import { PublicKey, SignatureScheme, toSerializedSignature } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';
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
} from "@secux/utility";
import { ow_fungibleData, ow_nftData, ow_objectFungibleData, ow_path, ow_publickey, ow_TransactionObject, SuiCurve, TransactionObject, txDetail } from "./interface";

export { SecuxSUI };

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
  // static async prepareSign(
  //   path: string,
  //   content: txDetail
  // ): Promise<{ commandData: communicationData; rawTx: communicationData }> {
  //   ow(path, ow_path);
  //   const curve = curveFromPath(path);
  //   const tx = new Transaction();
  //   tx.setSender(SecuxSUI.addressConvert(content.publickey, curve));
  //   tx.setGasPrice(Number(content.gasPrice));
  //   tx.setGasBudget(Number(content.gasBudget));

  //   tx.setGasPayment(content.gasPayment.map(ref => ({
  //     objectId: ref.objectId,
  //     version: String(ref.version),
  //     digest: ref.digest
  //   })));

  //   let transferObjects: TransactionObjectArgument[] = [];

  //   if (content.tokens) {
  //     ow(content, ow_tokenData);
  //     // Send Custom Token: Merge objects if needed, then split
  //     const primaryToken = tx.objectRef({
  //       objectId: content.tokens[0].objectId,
  //       version: String(content.tokens[0].version),
  //       digest: content.tokens[0].digest
  //     });

  //     const tokensToMerge = content.tokens.slice(1).map(ref => tx.objectRef({
  //       objectId: ref.objectId,
  //       version: String(ref.version),
  //       digest: ref.digest
  //     }));
  //     if (tokensToMerge.length > 0) {
  //       tx.mergeCoins(primaryToken, tokensToMerge);
  //     }

  //     const [token] = tx.splitCoins(primaryToken,[tx.pure.u64(content.amount)]);
  //     transferObjects = [token];
  //     tx.moveCall({
  //       target: coinTransferTarget,
  //       typeArguments: [ content.type.startsWith('0x2::coin::Coin') ? content.type : `0x2::coin::Coin<${content.type}>` ],
  //       arguments: [
  //         token,
  //         tx.pure.address(content.to)
  //       ],
  //     });
  //   } else if (content.nfts) {
  //     ow(content, ow_nftData);
  //     // Send NFTs: Transfer all specified objects directly
  //     transferObjects = content.nfts.map(ref => tx.objectRef({
  //       objectId: ref.objectId,
  //       version: String(ref.version),
  //       digest: ref.digest
  //     }));
  //     tx.transferObjects(transferObjects, content.to);
  //   } else {
  //     ow(content, ow_transferData);
  //     const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(content.amount!)]);
  //     transferObjects = [coin];
  //     tx.transferObjects(transferObjects, content.to);
  //   }

  //   const txBytes = await tx.build();

  //   const intentMessage = new Uint8Array([0, 0, 0].length + txBytes.length);
  //   intentMessage.set([0, 0, 0]);
  //   intentMessage.set(txBytes, 3);

  //   return wrapResult({
  //     commandData: SecuxTransactionTool.signRawTransaction(
  //       path,
  //       Buffer.from(intentMessage),
  //       {
  //         tp: TransactionType.NORMAL,
  //         curve: curve,
  //         chainId: 0
  //       }),
  //     rawTx: toCommunicationData(Buffer.from(txBytes)),
  //   });
  // }

  // static async prepareSign(
  //   path: string,
  //   content: txDetail
  // ): Promise<{ commandData: communicationData; rawTx: communicationData }> {
  //   ow(path, ow_path);
  //   const curve = curveFromPath(path);
  //   const tx = new Transaction();
  //   tx.setSender(SecuxSUI.addressConvert(content.publickey, curve));
  //   tx.setGasPrice(Number(content.gasPrice));
  //   tx.setGasBudget(Number(content.gasBudget));

  //   tx.setGasPayment(content.gasPayment.map(ref => ({
  //     objectId: ref.objectId,
  //     version: String(ref.version),
  //     digest: ref.digest
  //   })));

  //   let transferObjects: TransactionObjectArgument[] = [];

  //   if (content.tokens || content.withdrawAmount) {
  //     // ===== 代幣轉帳 (支援 Objects + Address Balance 並存) =====
  //     ow(content, ow_tokenData);

  //     const coinType = content.type.startsWith('0x2::coin::Coin') 
  //       ? content.type.replace('0x2::coin::Coin<', '').replace('>', '')
  //       : content.type;

  //     let primaryToken: TransactionObjectArgument | null = null;

  //     // 1. 處理實體 Coin Objects (如果有)
  //     if (content.tokens && content.tokens.length > 0) {
  //       primaryToken = tx.objectRef({
  //         objectId: content.tokens[0].objectId,
  //         version: String(content.tokens[0].version),
  //         digest: content.tokens[0].digest
  //       });

  //       const tokensToMerge = content.tokens.slice(1).map(ref => tx.objectRef({
  //         objectId: ref.objectId,
  //         version: String(ref.version),
  //         digest: ref.digest
  //       }));

  //       if (tokensToMerge.length > 0) {
  //         tx.mergeCoins(primaryToken, tokensToMerge);
  //       }
  //     }

  //     // 2. 處理從 Address Balance 提領 (如果後端算出來 withdrawAmount > 0)
  //     if (content.withdrawAmount && BigInt(content.withdrawAmount) > 0) {
  //       const [withdrawnCoin] = tx.moveCall({
  //         target: '0x2::balance::withdraw_funds',
  //         typeArguments: [coinType],
  //         arguments: [tx.pure.u64(content.withdrawAmount)],
  //       });

  //       if (primaryToken) {
  //         // 如果原本就有實體 Coin，將提領出來的 Coin 併入 Primary Coin
  //         tx.mergeCoins(primaryToken, [withdrawnCoin]);
  //       } else {
  //         // 如果原本完全沒有實體 Coin，提領出來的 Coin 就是 Primary Coin
  //         primaryToken = withdrawnCoin;
  //       }
  //     }

  //     if (!primaryToken) {
  //       throw new Error("No token objects or balance available for transfer.");
  //     }

  //     // 3. 裁切（Split）出精確的金額進行轉帳
  //     const [finalToken] = tx.splitCoins(primaryToken, [tx.pure.u64(content.amount)]);
      
  //     // 4. 執行轉帳
  //     tx.moveCall({
  //       target: coinTransferTarget,
  //       typeArguments: [`0x2::coin::Coin<${coinType}>`],
  //       arguments: [
  //         finalToken,
  //         tx.pure.address(content.to)
  //       ],
  //     });

  //   } else if (content.nfts) {
  //     ow(content, ow_nftData);
  //     // Send NFTs: Transfer all specified objects directly
  //     transferObjects = content.nfts.map(ref => tx.objectRef({
  //       objectId: ref.objectId,
  //       version: String(ref.version),
  //       digest: ref.digest
  //     }));
  //     tx.transferObjects(transferObjects, content.to);
  //   } else {
  //     // SUI 原生幣轉帳
  //     ow(content, ow_transferData);
  //     const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(content.amount!)]);
  //     transferObjects = [coin];
  //     tx.transferObjects(transferObjects, content.to);
  //   }

  //   const txBytes = await tx.build();

  //   const intentMessage = new Uint8Array([0, 0, 0].length + txBytes.length);
  //   intentMessage.set([0, 0, 0]);
  //   intentMessage.set(txBytes, 3);

  //   return wrapResult({
  //     commandData: SecuxTransactionTool.signRawTransaction(
  //       path,
  //       Buffer.from(intentMessage),
  //       {
  //         tp: TransactionType.NORMAL,
  //         curve: curve,
  //         chainId: 0
  //       }),
  //     rawTx: toCommunicationData(Buffer.from(txBytes)),
  //   });
  // }
  static async prepareSign(
      path: string,
      content: txDetail
  ): Promise<{ commandData: communicationData; rawTx: communicationData }> {
      if (content.transactionKind) return this.prepareSignBalance(path, content);
      if (content.nfts || content.tokens) return this.prepareSignObject(path, content);
      return this.prepareSignAddress(path, content);
  }

  /** Build a transaction that explicitly consumes Coin/Object inputs. */
  static async prepareSignObject(path: string, content: txDetail): Promise<{ commandData: communicationData; rawTx: communicationData }> {
      ow(path, ow_path);
      if (content.transactionKind) throw new Error('ArgumentError: prepareSignObject does not accept transactionKind');
      const curve = curveFromPath(path);
      const sender = SecuxSUI.addressConvert(content.publickey, curve);
      const tx = new Transaction();
      applyOfflineTransactionData(tx, content, sender);

      if (content.nfts?.length) {
          ow(content, ow_nftData);
          assertDistinctObjectRefs(content.nfts, content.gasPayment ?? []);
          tx.transferObjects(content.nfts.map(ref => tx.objectRef(toObjectRef(ref))), content.to);
      } else {
          ow(content, ow_objectFungibleData);
          const coinType = getPureCoinType(content.type);
          const amount = parseAmount(content.amount!);

          if (normalizeStructTag(coinType) === normalizeStructTag('0x2::sui::SUI')) {
              if (!content.gasPayment?.length) throw new Error('ArgumentError: SUI object transfer requires gasPayment');
              const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
              tx.transferObjects([coin], content.to);
          } else {
              if (!content.tokens?.length) throw new Error('ArgumentError: token object transfer requires tokens');
              assertDistinctObjectRefs(content.tokens, content.gasPayment ?? []);
              const coinObjects = content.tokens.map(ref => tx.objectRef(toObjectRef(ref)));
              const [primary, ...rest] = coinObjects;
              if (rest.length) tx.mergeCoins(primary, rest);
              const [coin] = tx.splitCoins(primary, [tx.pure.u64(amount)]);
              tx.transferObjects([coin], content.to);
          }
      }

      return prepareTransactionForDevice(path, curve, tx);
  }

  /** Build a transaction funded strictly from the sender's address balance. */
  static async prepareSignAddress(path: string, content: txDetail): Promise<{ commandData: communicationData; rawTx: communicationData }> {
      ow(path, ow_path);
      ow(content, ow_fungibleData);
      if (content.transactionKind) throw new Error('ArgumentError: prepareSignAddress does not accept transactionKind');
      if (content.tokens || content.nfts) throw new Error('ArgumentError: prepareSignAddress does not accept object inputs');

      const curve = curveFromPath(path);
      const sender = SecuxSUI.addressConvert(content.publickey, curve);
      const tx = new Transaction();
      applyOfflineTransactionData(tx, content, sender, true);

      const coinType = getPureCoinType(content.type);
      const withdrawal = tx.withdrawal({ amount: parseAmount(content.amount!), type: coinType });
      const [balance] = tx.moveCall({
          target: '0x2::balance::redeem_funds',
          typeArguments: [coinType],
          arguments: [withdrawal],
      });
      tx.moveCall({
          target: '0x2::balance::send_funds',
          typeArguments: [coinType],
          arguments: [balance, tx.pure.address(content.to)],
      });

      return prepareTransactionForDevice(path, curve, tx);
  }

  /** Sign an official tx.balance() result after enforcing a strict transfer policy. */
  static async prepareSignBalance(path: string, content: txDetail): Promise<{ commandData: communicationData; rawTx: communicationData }> {
      ow(path, ow_path);
      ow(content, ow_fungibleData);
      if (!content.transactionKind) throw new Error('ArgumentError: prepareSignBalance requires transactionKind');

      const curve = curveFromPath(path);
      const sender = SecuxSUI.addressConvert(content.publickey, curve);
      const tx = Transaction.fromKind(getBuffer(content.transactionKind));
      validateBalanceTransactionKind(tx, {
          sender,
          to: content.to,
          amount: parseAmount(content.amount!),
          coinType: getPureCoinType(content.type),
      });
      applyOfflineTransactionData(tx, content, sender);

      return prepareTransactionForDevice(path, curve, tx);
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

function toObjectRef(ref: { objectId: string; version: number | string; digest: string }) {
  return { objectId: ref.objectId, version: String(ref.version), digest: ref.digest };
}

function assertDistinctObjectRefs(
  transactionObjects: Array<{ objectId: string }>,
  gasObjects: Array<{ objectId: string }>,
) {
  const transactionIds = transactionObjects.map(ref => normalizeSuiAddress(ref.objectId));
  if (new Set(transactionIds).size !== transactionIds.length) {
    throw new Error('ArgumentError: duplicate transaction object');
  }
  const gasIds = new Set(gasObjects.map(ref => normalizeSuiAddress(ref.objectId)));
  if (transactionIds.some(id => gasIds.has(id))) {
    throw new Error('ArgumentError: gasPayment must not overlap transaction objects');
  }
}

function applyOfflineTransactionData(tx: Transaction, content: txDetail, sender: string, allowImplicitAddressGas = false) {
  tx.setSender(sender);
  tx.setGasOwner(content.gasOwner ?? sender);
  tx.setGasPrice(content.gasPrice);
  tx.setGasBudget(content.gasBudget);

  if (content.gasPayment === undefined && !allowImplicitAddressGas) {
    throw new Error('ArgumentError: offline signing requires gasPayment (use [] for address-balance gas)');
  }
  const gasPayment = content.gasPayment ?? [];
  tx.setGasPayment(gasPayment.map(toObjectRef));

  if (content.expiration) {
    tx.setExpiration(content.expiration);
  } else if (content.nonce !== undefined) {
    tx.setExpiration({ Epoch: content.nonce });
  } else if (gasPayment.length === 0) {
    throw new Error('ArgumentError: address-balance gas requires expiration');
  }
}

async function prepareTransactionForDevice(
  path: string,
  curve: SuiCurve,
  tx: Transaction,
): Promise<{ commandData: communicationData; rawTx: communicationData }> {
  const txBytes = await tx.build();
  const intentMessage = new Uint8Array(3 + txBytes.length);
  intentMessage.set([0, 0, 0], 0);
  intentMessage.set(txBytes, 3);

  return wrapResult({
    commandData: SecuxTransactionTool.signRawTransaction(path, Buffer.from(intentMessage), {
      tp: TransactionType.NORMAL,
      curve,
      chainId: 0,
    }),
    rawTx: toCommunicationData(Buffer.from(txBytes)),
  });
}

type BalancePolicy = { sender: string; to: string; amount: bigint; coinType: string };

function validateBalanceTransactionKind(tx: Transaction, policy: BalancePolicy) {
  const data: any = tx.getData();
  const inputs: any[] = data.inputs;
  const commands: any[] = data.commands;
  const coinType = normalizeStructTag(policy.coinType);
  const sender = normalizeSuiAddress(policy.sender);

  if (inputs.length > 64 || commands.length === 0 || commands.length > 64) {
    throw new Error('SecurityError: unsupported balance transaction size');
  }

  for (const input of inputs) {
    if (input.$kind === 'Pure') continue;
    if (input.$kind === 'Object' && input.Object?.$kind === 'ImmOrOwnedObject') continue;
    if (input.$kind === 'FundsWithdrawal') {
      const withdrawal = input.FundsWithdrawal;
      if (withdrawal.withdrawFrom?.$kind !== 'Sender') {
        throw new Error('SecurityError: only sender balance withdrawals are allowed');
      }
      if (normalizeStructTag(withdrawal.typeArg?.Balance) !== coinType) {
        throw new Error('SecurityError: withdrawal coin type mismatch');
      }
      continue;
    }
    throw new Error(`SecurityError: unsupported balance input ${input.$kind}`);
  }

  let recipientSendIndex = -1;
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    if (command.$kind === 'MergeCoins' || command.$kind === 'SplitCoins') continue;
    if (command.$kind !== 'MoveCall') {
      throw new Error(`SecurityError: unsupported balance command ${command.$kind}`);
    }

    const call = command.MoveCall;
    if (normalizeSuiAddress(call.package) !== normalizeSuiAddress('0x2')) {
      throw new Error('SecurityError: custom Move packages are not allowed');
    }
    const target = `${call.module}::${call.function}`;
    const allowed = new Set([
      'balance::redeem_funds',
      'balance::send_funds',
      'coin::redeem_funds',
      'coin::into_balance',
      'coin::send_funds',
    ]);
    if (!allowed.has(target)) throw new Error(`SecurityError: Move call ${target} is not allowed`);
    if (call.typeArguments.length !== 1 || normalizeStructTag(call.typeArguments[0]) !== coinType) {
      throw new Error('SecurityError: Move call coin type mismatch');
    }

    if (target === 'balance::send_funds') {
      if (recipientSendIndex !== -1) throw new Error('SecurityError: multiple recipient transfers are not allowed');
      assertAddressArgument(inputs, call.arguments[1], policy.to);
      assertExactBalanceAmount(inputs, commands, call.arguments[0], policy.amount);
      recipientSendIndex = index;
    } else if (target === 'coin::send_funds') {
      // The resolver may return change, but only to the signer.
      assertAddressArgument(inputs, call.arguments[1], sender);
    }
  }

  if (recipientSendIndex === -1 || recipientSendIndex !== commands.length - 1) {
    throw new Error('SecurityError: balance::send_funds must be the final command');
  }
}

function assertAddressArgument(inputs: any[], argument: any, expected: string) {
  if (argument?.$kind !== 'Input') throw new Error('SecurityError: recipient must be a pure input');
  const input = inputs[argument.Input];
  if (input?.$kind !== 'Pure') throw new Error('SecurityError: recipient must be a pure address');
  const bytes = fromBase64(input.Pure.bytes);
  if (bytes.length !== 32 || normalizeSuiAddress(`0x${Buffer.from(bytes).toString('hex')}`) !== normalizeSuiAddress(expected)) {
    throw new Error('SecurityError: recipient address mismatch');
  }
}

function assertExactBalanceAmount(inputs: any[], commands: any[], argument: any, expected: bigint) {
  if (argument?.$kind !== 'NestedResult' && argument?.$kind !== 'Result') {
    throw new Error('SecurityError: unsupported balance source');
  }
  const commandIndex = argument.$kind === 'NestedResult' ? argument.NestedResult[0] : argument.Result;
  const resultIndex = argument.$kind === 'NestedResult' ? argument.NestedResult[1] : 0;
  const command = commands[commandIndex];

  if (command?.$kind === 'SplitCoins') {
    const amountArg = command.SplitCoins.amounts[resultIndex];
    if (readPureU64(inputs, amountArg) !== expected) throw new Error('SecurityError: transfer amount mismatch');
    return;
  }
  if (command?.$kind !== 'MoveCall') throw new Error('SecurityError: unsupported balance source command');

  const call = command.MoveCall;
  const target = `${call.module}::${call.function}`;
  if (target === 'balance::redeem_funds' || target === 'coin::redeem_funds') {
    const withdrawalArg = call.arguments[0];
    if (withdrawalArg?.$kind !== 'Input') throw new Error('SecurityError: invalid withdrawal argument');
    const withdrawal = inputs[withdrawalArg.Input]?.FundsWithdrawal;
    if (!withdrawal || BigInt(withdrawal.reservation?.MaxAmountU64) !== expected) {
      throw new Error('SecurityError: transfer amount mismatch');
    }
    return;
  }
  if (target === 'coin::into_balance') {
    assertExactBalanceAmount(inputs, commands, call.arguments[0], expected);
    return;
  }
  throw new Error(`SecurityError: unsupported balance source ${target}`);
}

function readPureU64(inputs: any[], argument: any): bigint {
  if (argument?.$kind !== 'Input') throw new Error('SecurityError: amount must be a pure input');
  const input = inputs[argument.Input];
  if (input?.$kind !== 'Pure') throw new Error('SecurityError: amount must be a pure u64');
  const bytes = fromBase64(input.Pure.bytes);
  if (bytes.length !== 8) throw new Error('SecurityError: amount must be a pure u64');
  let value = BigInt(0);
  for (let i = 7; i >= 0; i--) value = (value << BigInt(8)) | BigInt(bytes[i]);
  return value;
}

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

function getPureCoinType(rawType: string | undefined): string {
    if (!rawType) return '0x2::sui::SUI';
    
    // 如果帶有 0x2::coin::Coin< ... > 包裝，將其撥開提取內部的 Type
    const match = rawType.match(/^0x2::coin::Coin<(.+)>$/);
    return match ? match[1] : rawType;
}

function parseAmount(value: number | string): bigint {
    let amount: bigint;

    if (typeof value === "number") {
        if (!Number.isSafeInteger(value)) {
            throw new Error(`ArgumentError: amount must be a safe integer, got ${value}`);
        }
        amount = BigInt(value);
    } else {
        const normalized = value.trim();

        if (/^0x[0-9a-f]+$/i.test(normalized)) {
            amount = BigInt(normalized);
        } else if (/^[0-9]+$/.test(normalized)) {
            amount = BigInt(normalized);
        } else if (/^(?=.*[a-f])[0-9a-f]+$/i.test(normalized)) {
            amount = BigInt(`0x${normalized}`);
        } else {
            throw new Error(`ArgumentError: unsupported amount format, got ${value}`);
        }
    }

    if (amount <= BigInt(0) || amount > BigInt("18446744073709551615")) {
        throw new Error(`ArgumentError: amount must be between 1 and 18446744073709551615, got ${value}`);
    }

    return amount;
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
