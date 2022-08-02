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


import { keccak256 } from "js-sha3";
const secp256k1 = require('secp256k1/elliptic');
import ow from 'ow';
import { checkFWVersion, loadPlugin, Logger, owTool, ow_strictPath } from '@secux/utility';
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve, TransactionType } from "@secux/protocol-transaction/lib/interface";
import { ow_tx155, ow_tx1559, tx155, tx1559, JsonString, isJsonString } from './interface';
import { ETHTransactionBuilder, getBuilder } from './transaction';
import { TypedDataUtils } from "eth-sig-util";
import { base64_regexp, communicationData, getBuffer, ow_communicationData, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
import { ERC20 } from "./erc20";
import { ERC721 } from "./erc721";
import { ERC1155 } from "./erc1155";
import { IPlugin, ITransport, staticImplements } from "@secux/transport";
export { SecuxETH, tx155, tx1559 };
const logger = Logger?.child({ id: "ethereum" });
const ow_path = ow_strictPath(60, 44);
const mcu = {
    crypto: "2.12",
    nifty: "0.02.1"
};


/**
 * ETH package for SecuX device
 */
@staticImplements<IPlugin>()
class SecuxETH {
    static readonly ERC20 = ERC20;
    static readonly ERC721 = ERC721;
    static readonly ERC1155 = ERC1155;


    /**
     * Convert publickey to ETH address.
     * @param {string|Buffer} publickey secp256k1 publickey
     * @returns {string} EIP55 address
     */
    static addressConvert(publickey: string | Buffer): string {
        const pk = validatePublickey(publickey);
        const uncompressed = secp256k1.publicKeyConvert(pk, false);

        // Only take the lower 160bits of the hash
        const address = keccak256(uncompressed.slice(1)).slice(-40);
        const encodedAddr = toChecksumAddress(address);

        return encodedAddr;
    }

    /**
     * Prepare data for address generation.
     * @param {string} path m/44'/60'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string): communicationData {
        return this.preparePublickey(path);
    }

    /**
     * Resolve address from response data.
     * @param {communicationData} response data from device
     * @returns {string} EIP55 address
     */
    static resolveAddress(response: communicationData): string {
        ow(response, ow_communicationData);

        const pk = SecuxETH.resolvePublickey(response);
        return SecuxETH.addressConvert(pk);
    }

    /**
     * Prepare data for secp256k1 publickey.
     * @param {string} path m/44'/60'/...
     * @returns {communicationData} data for sending to device
     */
    static preparePublickey(path: string): communicationData {
        ow(path, ow_path);

        return SecuxTransactionTool.getPublickey(path, EllipticCurve.SECP256K1);
    }

    /**
     * Resolve secp256k1 publickey from response data.
     * @param {communicationData} response data from device
     * @returns {string} secp256k1 publickey (hex string)
     */
    static resolvePublickey(response: communicationData) {
        const pk = SecuxTransactionTool.resolvePublickey(response, EllipticCurve.SECP256K1);
        return Buffer.from(pk, "base64").toString("hex");
    }

    /**
     * Prepare data for xpub generation.
     * @param {string} path m/44'/60'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareXPublickey(path: string) {
        ow(path, ow_path);

        return SecuxTransactionTool.getXPublickey(path);
    }

    /**
     * Generate xpub with response data.
     * @param {communicationData} response data from device
     * @param {string} path m/44'/60'/...
     * @returns {string} xpub
     */
    static resolveXPublickey(response: communicationData, path: string) {
        ow(path, ow_path);

        return SecuxTransactionTool.resolveXPublickey(response, path);
    }

    /**
     * Convert unsigned transaction to command data.
     * @param {string} path m/44'/60'/... 
     * @param {communicationData} serialized unsigned transaction
     * @returns {communicationData} data for sending to device
     */
    static prepareSignSerialized(path: string, serialized: communicationData): communicationData {
        ow(serialized, ow_communicationData);


        const buf = getBuffer(serialized);
        logger?.debug(`- prepareSignSerialized\ninput serialized tx: ${buf.toString("hex")}`);
        const builder = ETHTransactionBuilder.deserialize(buf);
        const isBlindSign = builder.tx.data?.length > 0;

        return prepareSign(path, builder, isBlindSign).commandData;
    }

    /**
     * Reslove signature from response data.
     * @param {communicationData} response data from device
     * @returns {string} signature (hex string)
     */
    static resolveSignature(response: communicationData) {
        return Buffer.from(SecuxTransactionTool.resolveSignature(response), "base64").toString("hex");
    }

    /**
     * Serialize transaction wtih signature for broadcasting.
     * @param {communicationData} response data from device
     * @param {communicationData} serialized unsigned transaction
     * @returns {string} signed raw transaction 
     */
    static resolveTransaction(response: communicationData, serialized: communicationData): string {
        ow(response, ow_communicationData);
        ow(serialized, ow_communicationData);


        const buf = getBuffer(serialized);
        const builder = ETHTransactionBuilder.deserialize(buf);
        const signature = Buffer.from(SecuxETH.resolveSignature(response), "hex");
        logger?.debug(`- resolveTransaction\ninput serialized tx: ${buf.toString("hex")}`);

        return `0x${builder.withSignature(signature).toString("hex")}`;
    }

    /**
     * Prepare data for signing.
     * @param {string} path m/44'/60'/... 
     * @param {tx155} content EIP-155 transaction object
     * @returns {prepared} prepared object
     */
    static prepareSignEIP155(path: string, content: tx155) {
        ow(content, ow_tx155);


        const builder = getBuilder(content);

        return prepareSign(path, builder, false);
    }

    /**
     * Reslove signature and follow ethereum signature standard.
     * @param {communicationData} response data from device
     * @param {number} [chainId] if give a chainId, the signature will be EIP-155 applied
     * @returns {string} signature (hex string)
     */
    static resolveSignatureEIP155(response: communicationData, chainId?: number): string {
        ow(response, ow_communicationData);
        ow(chainId, ow.optional.number.positive);


        const signature = Buffer.from(SecuxETH.resolveSignature(response), "hex");
        const v = signature[64];
        if (chainId === undefined) {
            signature.writeUInt8(27 + v, 64);
        }
        else {
            signature.writeUInt8(35 + 2 * chainId + v, 64);
        }


        return signature.toString("hex");
    }

    /**
     * Prepare data for signing (London Hard Fork).
     * @param {string} path m/44'/60'/... 
     * @param {tx1559} content EIP-1559 transaction object
     * @returns {prepared} prepared object
     */
    static prepareSignEIP1559(path: string, content: tx1559) {
        ow(content, ow_tx1559);


        const builder = getBuilder(content);

        return prepareSign(path, builder, false);
    }

    /**
     * Prepare data for signing.
     * @param {string} path m/44'/60'/... 
     * @param {string | Buffer} message
     * @returns {communicationData} data for sending to device
     */
    static prepareSignMessage(path: string, message: string | Buffer): communicationData {
        checkFWVersion("mcu", mcu[ITransport.deviceType], ITransport.mcuVersion);
        ow(path, ow_path);
        ow(message, ow.any(ow.string.nonEmpty, ow.buffer));

        let buffer;
        if (typeof message === "string") {
            if (message.startsWith("0x")) {
                buffer = Buffer.from(message.slice(2), "hex");
            }
            else {
                buffer = Buffer.from(message);
            }
        }

        return SecuxTransactionTool.signMessage(path, buffer ?? message);
    }

    /**
     * Prepare data for signing.
     * @param {string} path m/44'/60'/... 
     * @param {JsonString} data EIP712
     * @returns {communicationData} data for sending to device
     */
    static prepareSignTypedData(path: string, typedData: JsonString): communicationData {
        checkFWVersion("mcu", mcu[ITransport.deviceType], ITransport.mcuVersion);
        ow(path, ow_path);
        ow(typedData, ow.string);
        const data = JSON.parse(typedData);

        //@ts-ignore
        const sanitizedData = TypedDataUtils.sanitizeData(data);

        const parts = [];
        parts.push(
            TypedDataUtils.hashStruct(
                'EIP712Domain',
                sanitizedData.domain,
                sanitizedData.types,
                true
            )
        );
        if (sanitizedData.primaryType !== 'EIP712Domain') {
            parts.push(
                TypedDataUtils.hashStruct(
                    sanitizedData.primaryType.toString(),
                    sanitizedData.message,
                    sanitizedData.types,
                    true
                )
            );
        }

        const buf = Buffer.concat(parts);

        return SecuxTransactionTool.signTypedMessage(path, buf);
    }

    /**
     * Prepare data for signing using WalletConnect protocol.
     * @param {string} path m/44'/60'/... 
     * @param {tx155 | tx1559} content transaction object
     * @returns {prepared} prepared object
     */
    static prepareSignWalletConnectTransaction(path: string, content: tx155 | tx1559): { commandData: communicationData, rawTx: communicationData } {
        ow(path, ow_path);
        ow(content, ow.any(ow_tx155, ow_tx1559));

        const builder = getBuilder(content);
        return prepareSign(path, builder, true);
    }

    static async getAddress(this: ITransport, path: string) {
        const buffer = SecuxETH.prepareAddress(path);
        const response = await this.Exchange(getBuffer(buffer));
        const address = SecuxETH.resolveAddress(response);

        return address;
    }

    static async getPublickey(this: ITransport, path: string) {
        const buffer = SecuxETH.preparePublickey(path);
        const response = await this.Exchange(getBuffer(buffer));
        const publickey = SecuxETH.resolvePublickey(response);

        return publickey;
    }

    static async getXPublickey(this: ITransport, path: string) {
        const buffer = SecuxETH.prepareXPublickey(path);
        const response = await this.Exchange(getBuffer(buffer));
        const xpub = SecuxETH.resolveXPublickey(response, path);

        return xpub;
    }

    static async sign(this: ITransport, path: string, content: tx155, useWalletConnect?: boolean): Promise<{ raw_tx: string, signature: string }>
    static async sign(this: ITransport, path: string, content: tx1559, useWalletConnect?: boolean): Promise<{ raw_tx: string, signature: string }>
    static async sign(this: ITransport, path: string, serialized: communicationData): Promise<{ raw_tx: string, signature: string }>
    static async sign(this: ITransport, path: string, message: string, chainId?: number): Promise<{ signature: string }>
    static async sign(this: ITransport, path: string, typedData: JsonString, chainId?: number): Promise<{ signature: string }>
    static async sign(this: ITransport, path: string, args: any, option?: any) {
        const signSerialized = async () => {
            const data = SecuxETH.prepareSignSerialized(path, args);
            const rsp = await this.Exchange(getBuffer(data));
            let signature = Buffer.from(SecuxETH.resolveSignature(rsp), "hex");
            signature = ETHTransactionBuilder.deserialize(getBuffer(args)).getSignature(signature);

            return {
                raw_tx: SecuxETH.resolveTransaction(rsp, args),
                signature: `0x${signature.toString("hex")}`
            }
        };


        if (typeof args === "string") {
            if (args.match(base64_regexp)) {
                return signSerialized();
            }

            const func = isJsonString(args) ? SecuxETH.prepareSignTypedData : SecuxETH.prepareSignMessage;

            const data = func(path, args);
            const rsp = await this.Exchange(getBuffer(data));
            const signature = SecuxETH.resolveSignatureEIP155(rsp, option);

            return {
                raw_tx: undefined,
                signature: `0x${signature}`
            }
        }

        if (Buffer.isBuffer(args)) {
            return signSerialized();
        }


        let func: any = SecuxETH.prepareSignEIP155;

        if (typeof option === "boolean" && option) {
            func = SecuxETH.prepareSignWalletConnectTransaction;
        }

        if (args.accessList ||
            args.maxPriorityFeePerGas ||
            args.maxFeePerGas
        ) {
            func = SecuxETH.prepareSignEIP1559;
        }

        const { commandData, rawTx } = func(path, args);
        const rsp = await this.Exchange(getBuffer(commandData));
        let signature = Buffer.from(SecuxETH.resolveSignature(rsp), "hex");
        signature = ETHTransactionBuilder.deserialize(getBuffer(rawTx)).getSignature(signature);

        return {
            raw_tx: SecuxETH.resolveTransaction(rsp, rawTx),
            signature: `0x${signature.toString("hex")}`
        }
    }
}

loadPlugin(SecuxETH, "SecuxETH");


function toChecksumAddress(address: string) {
    address = address.toLowerCase().replace(/^0x/, '');
    const hash = keccak256(address);
    let ret = '0x';

    for (let i = 0; i < address.length; i++) {
        if (parseInt(hash[i], 16) >= 8) {
            ret += address[i].toUpperCase()
        } else {
            ret += address[i]
        }
    }

    return ret;
}

export function prepareSign(path: string, builder: ETHTransactionBuilder, isBlind: boolean, tp?: TransactionType): { commandData: communicationData, rawTx: communicationData } {
    checkFWVersion("mcu", mcu[ITransport.deviceType], ITransport.mcuVersion);
    ow(path, ow_path);

    if (tp === undefined) {
        if (builder.tx.value === undefined || builder.tx.value == "0")
            tp = TransactionType.TOKEN;
        else
            tp = TransactionType.NORMAL;
    }
    if (isBlind) tp = TransactionType.NORMAL;

    const option = {
        tp,
        curve: EllipticCurve.SECP256K1,
        chainId: builder.chainId ?? 1
    };
    // firmware restriction: uint16LE
    if (option.chainId > 65535) { option.chainId = 65535; }

    const buf = (!isBlind)
        ? SecuxTransactionTool.signRawTransaction(path, builder.serialize(), option)
        : SecuxTransactionTool.signTransaction(path, builder.serialize(true), option);

    return wrapResult({
        commandData: buf,
        rawTx: toCommunicationData(builder.serialize())
    });
}

function validatePublickey(data: string | Buffer) {
    ow(data, ow.any(owTool.hexString, ow.buffer));

    const pk = (typeof data === "string") ? Buffer.from(data, "hex") : data;
    ow(pk, ow.buffer.is(x => x.length === 33 || x.length === 65));

    if (!secp256k1.publicKeyVerify(pk)) {
        throw Error(`ArgumentError: invalid secp256k1 publickey, got "${pk.toString("hex")}"`);
    }

    return pk;
}


/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * The payment object for EIP-155.
 * @typedef {object} tx155 
 * @property {number | string} chainId network for ethereum ecosystem
 * @property {string} to receiving address
 * @property {number | string} value sending amount
 * @property {number | string} nonce the number of transactions sent from this address
 * @property {number | string} gasPrice the price of gas (unit: wei)
 * @property {number | string} gasLimit the maximum amount of gas you are willing to consume
 * @property {string} [data] abi-encoded data payload
 */

/**
 * The payment object for EIP-1559.
 * @typedef {object} tx1559 
 * @property {number | string} chainId network for ethereum ecosystem
 * @property {string} to receiving address
 * @property {number | string} value sending amount
 * @property {number | string} nonce the number of transactions sent from this address
 * @property {number | string} maxPriorityFeePerGas the maximum priority fee of gas (unit: wei)
 * @property {number | string} maxFeePerGas the maximum price of gas (unit: wei)
 * @property {number | string} gasLimit the maximum amount of gas you are willing to consume
 * @property {Array<any>} [content.accessList]
 * @property {string} [data] abi-encoded data payload
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {communicationData} commandData data for sending to device
 * @property {communicationData} serialized unsigned transaction
 */