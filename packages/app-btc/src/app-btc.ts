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


const secp256k1 = require('secp256k1/elliptic');
import * as varuint from 'varuint-bitcoin';
import { loadPlugin, ow_strictPath, Signature } from '@secux/utility';
import { decodeXPUB, deriveKey } from "@secux/utility/lib/xpub";
import ow from 'ow';
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { communicationData, getBuffer, ow_communicationData, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
import { splitPath } from "@secux/utility/lib/BIP32Path";
import { EllipticCurve } from "@secux/protocol-transaction/lib/interface";
import {
    CoinType, txInput, txOutput, ScriptType, txOutputAddress, txOutputScriptExtened, ow_txInput, ow_txOutput,
    coinmap, isOutuptScriptExtended, AddressOption, ow_AddressOption, btcPurposes, PathObject, ow_path, ow_PathObject,
    SignOption, ow_SignOption, ow_accountPath, TransactionObject, ow_TransactionObject
} from './interface';
import { SecuxPsbt } from './psbt';
import {
    getCoinType, getDefaultScript, getDustThreshold, getInScriptSize, getOutScriptSize, getPayment, getPublickey,
    getPurpose, getWitnessSize, sliceSize, vectorSize
} from './utils';
import { IPlugin, ITransport, staticImplements } from "@secux/transport";
import { PaymentBTC } from './payment';
import { PaymentBCH } from './payment_bch';
import { PaymentGRS } from './payment_grs';
export { AddressOption, CoinType, ScriptType, txInput, txOutput, txOutputAddress, txOutputScriptExtened };


/**
 * BTC package for SecuX device
 */
@staticImplements<IPlugin>()
export class SecuxBTC {
    /**
     * Convert publickey to BTC address.
     * @param {string | Buffer} publickey secp256k1 publickey (hex string or buffer)
     * @param {string | PathObject} path BIP32 path, ex: m/44'/0'/0'/0/0
     * @returns {string} address
     */
    static addressConvert(publickey: string | Buffer, path: string | PathObject): string {
        const pk = getPublickey(publickey);
        ow(path, ow.any(ow_path, ow_PathObject));


        const compressed = Buffer.from(secp256k1.publicKeyConvert(pk, true));

        const coin = (typeof path === "string") ? getCoinType(path) : path.coin;
        const script = (typeof path === "string") ? getDefaultScript(path) : path.script;
        const payment = getPayment(coin);
        switch (script) {
            case ScriptType.P2SH_P2WPKH:
                const p2wpkh = payment.p2wpkh(coin, { publickey: compressed });
                return payment.p2sh(coin, { redeemScript: p2wpkh.scriptPublickey }).address;

            case ScriptType.P2SH_P2PKH:
                const p2pkh = payment.p2pkh(coin, { publickey: compressed });
                return payment.p2sh(coin, { redeemScript: p2pkh.scriptPublickey }).address;

            case ScriptType.P2PKH:
                return payment.p2pkh(coin, { publickey: compressed }).address;

            case ScriptType.P2WPKH:
                return payment.p2wpkh(coin, { publickey: compressed }).address;

            case ScriptType.P2TR:
                return payment.p2tr(coin, { publickey: compressed }).address;

            default:
                throw Error(`Invalid or unsupported ScriptType, got ${script} of ${coin}`);
        }
    }

    /**
     * Prepare data for address generation.
     * @param {string} path BIP32 path, ex: m/44'/0'/0'/0/0
     * @param {AddressOption} [option] for path validation
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string, option?: AddressOption): communicationData {
        return this.preparePublickey(path, option);
    }

    /**
     * Generate address from response data.
     * @param {communicationData} response data from device
     * @param {string | PathObject} path BIP32 path, ex: m/44'/0'/0'/0/0
     * @returns {string} address
     */
    static resolveAddress(response: communicationData, path: string | PathObject): string {
        const pk = SecuxBTC.resolvePublickey(response);
        return SecuxBTC.addressConvert(pk, path);
    }

    /**
     * Prepare data for secp256k1 publickey.
     * @param {string} path BIP32 path, ex: m/44'/0'/0'/0/0
     * @param {AddressOption} [option] for path validation
     * @returns {communicationData} data for sending to device
     */
    static preparePublickey(path: string, option?: AddressOption): communicationData {
        ow(path, ow_path);
        if (option) ow(option, ow_AddressOption);

        const coin = option?.coin ?? getCoinType(path);
        const cointype = coinmap[coin].coinType;
        const purpose = (option?.script === undefined) ? undefined : getPurpose(option?.script);
        ow(path, ow_strictPath(cointype, purpose));

        return SecuxTransactionTool.getPublickey(path, EllipticCurve.SECP256K1);
    }

    /**
     * Resolve secp256k1 publickey from response data.
     * @param {communicationData} response data from device
     * @returns {string} secp256k1 publickey (hex string)
     */
    static resolvePublickey(response: communicationData) {
        const pk = SecuxTransactionTool.resolvePublickey(response, EllipticCurve.SECP256K1, true);
        return Buffer.from(pk, "base64").toString("hex");
    }

    /**
     * Prepare data for extended publickey generation.
     * @param {string} path BIP32 path, ex: m/44'/0'/0'/0/0
     * @returns {communicationData} data for sending to device
     */
    static prepareXPublickey(path: string) {
        ow(path, ow_accountPath);

        return SecuxTransactionTool.getXPublickey(path);
    }

    /**
     * Generate extended publickey from response data.
     * @param {communicationData} response data from device
     * @param {string} path BIP32 path, ex: m/44'/0'/0'/0/0
     * @returns {string} extended publickey (xpub, ypub or zpub)
     */
    static resolveXPublickey(response: communicationData, path: string) {
        ow(path, ow_accountPath);

        return SecuxTransactionTool.resolveXPublickey(response, path);
    }

    /**
     * Prepare data for signing.
     * @param {txInput} inputs array of utxo object
     * @param {txOutput} outputs output object
     * @param {SignOption} [option] 
     * @returns {prepared}
     */
    static prepareSign(inputs: Array<txInput>, outputs: txOutput, option?: SignOption)
        : { commands: Array<communicationData>, rawTx: string } {
        ow(inputs, ow.array.ofType(ow_txInput).minLength(1));
        ow(option as any, ow.any(ow.undefined, ow_SignOption));
        const coin = option?.coin ?? getCoinType(inputs[0].path);
        ow(outputs, ow_txOutput);

        const setPublickey = (data: any) => {
            const xpub = option?.xpub;
            if (!xpub) return;
            if (data.publickey) return;

            const bip32 = splitPath(data.path);
            data.publickey = SecuxBTC.derivePublicKey(xpub, bip32.change!.value, bip32.addressIndex!.value);
        };

        inputs.forEach(input => {
            const purpose = (input.script) ? getPurpose(input.script) : btcPurposes;
            //@ts-ignore
            ow(input.path, ow_strictPath(coinmap[coin].coinType, purpose));

            setPublickey(input);
        });

        let _ = isOutuptScriptExtended(outputs.to);
        if (_) {
            const purpose = (_.script) ? getPurpose(_.script) : btcPurposes;
            //@ts-ignore
            ow(_.path, ow_strictPath(coinmap[coin].coinType, purpose));

            setPublickey(outputs.to);
        }
        if (outputs.utxo) {
            const purpose = (outputs.utxo.script) ? getPurpose(outputs.utxo.script) : btcPurposes;
            //@ts-ignore
            ow(outputs.utxo.path, ow_strictPath(coinmap[coin].coinType, purpose));

            setPublickey(outputs.utxo);
        }

        const psbt = new SecuxPsbt(coin, option?.isRBF);
        psbt.AddInputs(inputs);
        psbt.AddOutputs(outputs.utxo ? [outputs.to, outputs.utxo] : [outputs.to]);

        return wrapResult(psbt.PrepareSign(option?.feeRate));
    }

    /**
     * Reslove signature from response data.
     * @param {communicationData} response data from device
     * @returns {Array<string>} signature array of hex string
     */
    static resolveSignatureList(response: communicationData) {
        const sigBufList = SecuxTransactionTool.resolveSignatureList(response).map(x => Buffer.from(x, "base64"));
        const sigList = sigBufList.map(x => Signature.fromSignature(x));

        return sigList.map(x => Buffer.concat([x.r, x.s]).toString("hex"));
    }

    /**
     * Serialize transaction wtih signature for broadcasting.
     * @param {communicationData|Array<communicationData>} response data from device
     * @param {TransactionObject} params
     * @returns {string} signed raw transaction
     */
    static resolveTransaction(response: communicationData | Array<communicationData>, params: TransactionObject): string {
        ow(response, ow.any(ow_communicationData, ow.array.ofType(ow_communicationData)));
        ow(params, ow_TransactionObject);


        response = Array.isArray(response) ? response : [response];
        const signatures: Array<Buffer> = [];
        for (const rsp of response) {
            const sigList = SecuxBTC.resolveSignatureList(rsp).map(x => Buffer.from(x, "hex"));
            signatures.push(...sigList);
        }
        const pks = params.publickeys.map(x => getPublickey(x));

        const psbt = SecuxPsbt.FromBuffer(Buffer.from(params.rawTx, "hex"), params.coin ?? CoinType.BITCOIN);
        const tx = psbt.appendSignature(signatures, pks)
            .finalizeAllInputs()
            .extractTransaction()
            .toHex();

        return tx;
    }

    static async getAddress(this: ITransport, path: string, option?: AddressOption) {
        const data = SecuxBTC.prepareAddress(path, option);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxBTC.resolveAddress(rsp, {
            coin: option?.coin ?? getCoinType(path),
            script: option?.script ?? getDefaultScript(path)
        });

        return address;
    }

    static async getPublickey(this: ITransport, path: string, option?: AddressOption) {
        const data = SecuxBTC.preparePublickey(path, option);
        const rsp = await this.Exchange(getBuffer(data));
        const publickey = SecuxBTC.resolvePublickey(rsp);

        return publickey;
    }

    static async getXPublickey(this: ITransport, path: string) {
        const data = SecuxBTC.prepareXPublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const xpub = SecuxBTC.resolveXPublickey(rsp, path);

        return xpub;
    }

    static async sign(this: ITransport, inputs: Array<txInput>, outputs: txOutput, option?: SignOption)
        : Promise<{ multi_command: Array<communicationData>; } & TransactionObject> {
        const cache: { [path: string]: communicationData } = {};
        const getPK = async (path: string) => {
            if (cache[path] !== undefined) return cache[path];

            const publickey = await SecuxBTC.getPublickey.call(this, path, { coin });
            const pk = Buffer.from(publickey, "hex");

            cache[path] = pk;
            return pk;
        }

        const coin = option?.coin ?? getCoinType(inputs[0].path);

        if (!option?.xpub) {
            for (const txIn of inputs) {
                if (txIn.publickey !== undefined) continue;

                txIn.publickey = await getPK(txIn.path);
            }

            //@ts-ignore
            if (outputs.to.path && outputs.to.publickey === undefined) {
                //@ts-ignore
                outputs.to.publickey = await getPK(outputs.to.path);
            }

            if (outputs.utxo?.path && outputs.utxo.publickey === undefined) {
                outputs.utxo.publickey = await getPK(outputs.utxo.path);
            }
        }

        const { commands, rawTx } = SecuxBTC.prepareSign(inputs, outputs, { ...option, coin });
        return {
            multi_command: commands,
            rawTx,
            publickeys: inputs.map(x => x.publickey!),
            coin
        }
    }

    /**
     * Derive public key from xpub.
     * @param {string} xpub extended publickey (base58 encoded), depth must be 3
     * @param {number} change BIP44 change field
     * @param {number} addressIndex BIP44 address_index field
     * @returns {communicationData} publickey
     */
    static derivePublicKey(xpub: string | any, change: number, addressIndex: number): communicationData {
        ow(change, ow.number.uint32);
        ow(addressIndex, ow.number.uint32);

        const _xpub = typeof xpub === "string" ? decodeXPUB(xpub) : xpub;
        if (_xpub.depth !== 3) throw Error(`ArgumentError: expect depth from xpub is 3, but got ${_xpub.depth}`);

        const { publickey } = deriveKey(_xpub.publickey, _xpub.chaincode, [change, addressIndex]);
        return toCommunicationData(publickey);
    }

    /**
     * Derive xpub and generate BTC address.
     * @param {string} xpub extended publickey (base58 encoded), depth must be 3
     * @param {number} change BIP44 change field
     * @param {number} addressIndex BIP44 address_index field
     * @param {AddressOption} [option] for address generation
     * @returns {string} address
     */
    static deriveAddress(xpub: string, change: number, addressIndex: number, option?: AddressOption): string {
        ow(option as AddressOption, ow.any(ow.undefined, ow_AddressOption));

        const _xpub = decodeXPUB(xpub);
        if (option?.script) {
            if ([ScriptType.P2PKH, ScriptType.P2SH_P2PKH, ScriptType.P2SH_P2WPKH, ScriptType.P2WPKH].includes(option.script)) {
                const purpose = getPurpose(option?.script);
                if (_xpub.purpose !== purpose) {
                    throw Error(`ArgumentError: expect purpose from xpub is ${purpose}, but got ${_xpub.purpose}`);
                }
            }
            else {
                if (_xpub.purpose !== 44) throw Error(`ArgumentError: expect purpose from xpub is 44, but got ${_xpub.purpose}`);
            }
        }

        const publickey = SecuxBTC.derivePublicKey(_xpub, change, addressIndex);
        const coin = option?.coin ?? CoinType.BITCOIN;
        const script = option?.script ?? getDefaultScript(`m/${_xpub.purpose}'`);

        return SecuxBTC.addressConvert(getBuffer(publickey), { coin, script });
    }

    /**
     * Estimate virtual size of transaction.
     * @param {Array<ScriptType>} inputs 
     * @param {Array<ScriptType>} outputs 
     * @returns {number} virtual size
     */
    static getVirtualSize(inputs: Array<ScriptType>, outputs: Array<ScriptType>): number {
        const baseSize =
            8 +
            varuint.encodingLength(inputs.length) +
            varuint.encodingLength(outputs.length) +
            inputs.reduce((sum, input) => sum + 40 + sliceSize(getInScriptSize(input)), 0) +
            outputs.reduce((sum, output) => sum + 8 + sliceSize(getOutScriptSize(output)), 0);

        const inputsWitness = inputs.map(x => getWitnessSize(x));
        const hasWitness = inputsWitness.some(x => x.length !== 0);
        const witnessSize = (!hasWitness) ? 0 :
            2 + inputsWitness.reduce((sum, w) => sum + vectorSize(w), 0);

        return (baseSize * 4 + witnessSize) / 4;
    }

    /**
     * Estimate dust threshold of an output.
     * @param {ScriptType} output script type of txout
     * @param {number} [dustRelayFee] satoshis/vB, default: 3
     * @returns {number} dust threshold
     */
    static getDustThreshold(output: ScriptType, dustRelayFee: number = 3): number {
        return getDustThreshold(output, dustRelayFee);
    }

    /**
     * Validate address.
     * @param {string} address
     * @param {CoinType} [coin] default: CoinType.BITCOIN
     * @returns {boolean} true if address is valid
     */
    static validateAddress(address: string, coin: CoinType = CoinType.BITCOIN): boolean {
        try {
            switch (coin) {
                case CoinType.BITCOINCASH:
                    PaymentBCH.decode(coin, address);
                    break;

                case CoinType.GROESTL:
                    PaymentGRS.decode(coin, address);
                    break;

                default:
                    PaymentBTC.decode(coin, address);
            }
        } catch (error) {
            return false;
        }

        return true;
    }

    /**
     * Get script type of address.
     * @param {string} address
     * @param {CoinType} [coin] default: CoinType.BITCOIN
     * @returns {ScriptType} script type of address
     */
    static getScriptType(address: string, coin: CoinType = CoinType.BITCOIN): ScriptType {
        try {
            switch (coin) {
                case CoinType.BITCOINCASH: {
                    const script = PaymentBCH.decode(coin, address);
                    return PaymentBCH.classify(script);
                }

                case CoinType.GROESTL: {
                    const script = PaymentGRS.decode(coin, address);
                    return PaymentGRS.classify(script);                    
                }
                    
                default: {
                    const script = PaymentBTC.decode(coin, address);
                    return PaymentBTC.classify(script);
                }
            }
        } catch (error) {
            throw Error("unknown script type");
        }
    }
}

loadPlugin(SecuxBTC, "SecuxBTC");


/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * Script type for input/output.
 * @typedef {enum} ScriptType
 * @property {number} P2PKH 0
 * @property {number} P2WPKH 1
 * @property {number} P2SH_P2PKH 2 
 * @property {number} P2SH_P2WPKH 3
 * @property {number} P2TR 4
 */

/**
 * Coins that are nearly identical to Bitcoin.
 * @typedef {enum} CoinType
 * @property {number} BITCOIN 0
 * @property {number} TESTNET 1
 * @property {number} REGTEST 2
 * @property {number} LITECOIN 3
 * @property {number} BITCOINCASH 4
 * @property {number} GROESTL 5
 * @property {number} DIGIBYTE 6
 * @property {number} DASH 7
 * @property {number} DOGECOIN 8
 */

/**
 * Parameters for address generation.
 * @typedef {object} PathObject 
 * @property {CoinType} coin enum
 * @property {ScriptType} script enum
 */

/**
 * Options for path validation.
 * @typedef {object} AddressOption 
 * @property {CoinType} [coin] enum
 * @property {ScriptType} [script] enum
 */

/**
 * UTXO.
 * @typedef {object} txInput
 * @property {string} path BIP32 path refer to utxo
 * @property {string | Buffer} publickey scep256k1 publickey from `path`
 * @property {string} hash referenced transaction hash
 * @property {number} vout referenced transaction output index
 * @property {number | string} satoshis referenced transaction output amount
 * @property {ScriptType} [script] script type related to `path`
 * @property {string} [txHex] referenced raw transaction for validation
 */

/**
 * Outputs consist of one payment and one or no return.
 * @typedef {object} txOutput
 * @property {txOutputAddress | txOutputScriptExtened} to receiving address information
 * @property {txOutputScriptExtened} [utxo] changes
 */

/**
 * Receiving address and payment.
 * @typedef {object} txOutputAddress
 * @property {string} address receiving address
 * @property {number | string} satoshis receiving amount
 */

/**
 * Payment for another held account.
 * @typedef {object} txOutputScriptExtened
 * @property {string} path BIP32 path
 * @property {string | Buffer} publickey scep256k1 publickey from `path`
 * @property {number | string} satoshis amount
 * @property {ScriptType} [script] script type related to `path`
 */

/**
 * Options used during the signing.
 * @typedef {object} SignOption
 * @property {CoinType} [coin] check cointype for each input
 * @property {number} [feeRate] calculate optimal transaction fee and replace it
 * @property {boolean} [isRBF] make Replace-by-Fee transaction
 * @property {string} [xpub] account's extended publickey
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {communicationData} commandData data for sending to device
 * @property {string} rawTx unsigned raw transaction
 */

/**
 * Paramters for finalizing transaction.
 * @typedef {object} TransactionObject
 * @property {string} rawTx unsigned raw transaction
 * @property {Array<string | Buffer>} publickeys publickey correspond to each input
 * @property {CoinType} [coin]
 */