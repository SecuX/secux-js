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


import { cardano } from "./load_lib";
const cardanoV1 = require("cardano-crypto.js");
import { communicationData, getBuffer, ow_communicationData, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
import {
    AddressOption, AddressType, DrepType, NetworkInfo, ow_AddressOption, ow_fullPath, ow_path, ow_PointerOption, ow_poolHash,
    ow_SignOption, ow_StakeInput, ow_StakeOption, ow_TxInput, ow_TxOutput, ow_UnStakeOption, ow_WithdrawOption,
    ow_xpublickey, SignOption, StakeInput, StakeOption, TxInput, TxOutput, UnStakeOption, WithdrawOption
} from "./interface";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve, TransactionType } from "@secux/protocol-transaction/lib/interface";
import ow from "ow";
import { loadPlugin, Logger, owTool, Signature } from "@secux/utility";
import { IPlugin, ITransport, staticImplements } from "@secux/transport";
export { SecuxADA, AddressType, DrepType };
const logger = Logger?.child({ id: "ada" });


const HardenedOffset = 0x80000000;
const calculateFee = (size: number) => cardano.__fee_a * size + cardano.__fee_b;


/**
 * ADA package for SecuX device
 */
@staticImplements<IPlugin>()
class SecuxADA {
    /**
     * Convert bip32-publickey to ADA address.
     * @param {string|Buffer} xpublickey ada bip32-publickey
     * @param {AddressType} type
     * @param {AddressOption} [option]
     * @returns {string} address
     */
    static addressConvert(xpublickey: string | Buffer, type: AddressType, option?: AddressOption): string {
        ow(xpublickey, ow_xpublickey);
        ow(type, ow.number.inRange(0, AddressType.__LENGTH - 1));
        ow(option as AddressOption, ow.any(ow.undefined, ow_AddressOption));


        const ed25519key = convertToBuffer(xpublickey);
        const pubkey = cardano.Bip32PublicKey.from_bytes(ed25519key);
        const utxoKey = pubkey.derive(0).derive(option?.addressIndex ?? 0);
        const stakeKey = pubkey.derive(2).derive(option?.stakeIndex ?? 0);

        const network = option?.network ?? NetworkInfo.mainnet;
        switch (type) {
            case AddressType.BOOTSTRAPv1:
                const { pbkdf2Sync } = require("pbkdf2");
                const passphrase = pbkdf2Sync(ed25519key, "address-hashing", 500, 32, "sha512");

                return cardanoV1.base58.encode(cardanoV1.packBootstrapAddress(
                    [HardenedOffset, HardenedOffset | (option?.addressIndex ?? 0)],
                    ed25519key,
                    passphrase,
                    1,
                    network.protocol
                ));

            case AddressType.BOOTSTRAPv2:
                return cardano.ByronAddress.icarus_from_key(
                    utxoKey,
                    network.protocol
                ).to_base58();

            case AddressType.BASE:
                return cardano.BaseAddress.new(
                    network.id,
                    cardano.Credential.from_keyhash(utxoKey.to_raw_key().hash()),
                    cardano.Credential.from_keyhash(stakeKey.to_raw_key().hash())
                ).to_address().to_bech32();

            case AddressType.ENTERPRISE:
                return cardano.EnterpriseAddress.new(
                    network.id,
                    cardano.Credential.from_keyhash(utxoKey.to_raw_key().hash())
                ).to_address().to_bech32();

            case AddressType.POINTER:
                const params = option!.pointer;
                ow(params, ow_PointerOption);
                return cardano.PointerAddress.new(
                    network.id,
                    cardano.Credential.from_keyhash(utxoKey.to_raw_key().hash()),
                    cardano.Pointer.new(
                        params.slot,
                        params.txIndex,
                        params.certIndex
                    )
                ).to_address().to_bech32();

            case AddressType.REWARD:
                return cardano.RewardAddress.new(
                    network.id,
                    cardano.Credential.from_keyhash(stakeKey.to_raw_key().hash())
                ).to_address().to_bech32();

            default:
                throw Error(`ArgumentError: unsupported address type, got ${AddressType[type]}`);
        }
    }

    /**
     * Prepare data for address generation.
     * @param {string} pathWith3Depth m/1852'/1815'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(pathWith3Depth: string): communicationData {
        return SecuxADA.prepareXPublickey(pathWith3Depth);
    }

    /**
     * Resolve address from response data.
     * @param {communicationData} response data from device
     * @param {AddressType} type 
     * @param {AddressOption} [option]
     * @returns {string} address
     */
    static resolveAddress(response: communicationData, type: AddressType, option?: AddressOption): string {
        ow(type, ow.number.inRange(0, AddressType.__LENGTH));
        const pk = SecuxADA.resolveXPublickey(response);

        return SecuxADA.addressConvert(pk, type, option);
    }

    /**
     * Prepare data for bip32-publickey.
     * @param {string} pathWith3Depth m/1852'/1815'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareXPublickey(pathWith3Depth: string): communicationData {
        ow(pathWith3Depth, ow_path);

        return SecuxTransactionTool.getXPublickey(pathWith3Depth, EllipticCurve.ED25519_ADA);
    }

    /**
     * Resolve bip32-publickey from response data.
     * @param {communicationData} response data from device
     * @returns {string} bip32-publickey (hex string)
     */
    static resolveXPublickey(response: communicationData): string {
        return SecuxTransactionTool.resolveXPublickey(response, undefined, EllipticCurve.ED25519_ADA);
    }

    /**
     * Prepare data for signing.
     * @param {Array<TxInput>} inputs 
     * @param {TxOutput} output 
     * @param {SignOption} [option] 
     * @returns {prepared}
     */
    static prepareSign(inputs: Array<TxInput>, output: TxOutput, option?: SignOption) {
        ow(inputs, ow.array.ofType(ow_TxInput));
        ow(output, ow_TxOutput);
        ow(option as SignOption, ow.any(ow.undefined, ow_SignOption));


        const config = (output.address.startsWith("DdzFF")) ? cardano.__byronConfig : cardano.__config;
        const { builder, paths, publickeys } = CreateBaseTransaction(inputs, config);


        let address;
        try {
            address = cardano.Address.from_bech32(output.address);
        }
        catch (error) {
            address = cardano.Address.from_bytes(
                cardanoV1.base58.decode(output.address)
            );
        }

        builder.add_output(
            cardano.TransactionOutput.new(
                address,
                cardano.Value.new(cardano.BigNum.from_str(output.amount.toString(10)))
            )
        );


        const rawTx = CreateRawTransaction(builder, option);
        return CreateCommandData(paths, publickeys, rawTx);
    }

    /**
     * Reslove signatures from response data.
     * @param {communicationData} response data from device
     * @returns {Array<string>} signature array of hex string
     */
    static resolveSignatureList(response: communicationData) {
        const sigBufList = SecuxTransactionTool.resolveSignatureList(response).map(x => Buffer.from(x, "base64"));
        const sigList = sigBufList.map(x => Signature.fromSignature(x));

        return sigList.map(x => Buffer.concat([x.r, x.s]).toString("hex"));
    }

    /**
     * Resolve transaction for broadcasting.
     * @param {communicationData} response data from device
     * @param {communicationData} serialized 
     * @returns {string} signed transaction (base64 encoded)
     */
    static resolveTransaction(response: communicationData, serialized: communicationData) {
        ow(serialized, ow_communicationData);

        const txObj = JSON.parse(getBuffer(serialized).toString());
        const signatures = SecuxADA.resolveSignatureList(response);

        const paths: Array<string> = Object.keys(txObj.pathMap);
        if (signatures.length !== paths.length) {
            throw Error(`expect ${paths.length} signature(s), but got ${signatures.length}`);
        }

        const txbody = cardano.TransactionBody.from_bytes(Buffer.from(txObj.rawTx, "hex"));
        const vkeys = cardano.Vkeywitnesses.new();
        for (let i = 0; i < paths.length; i++) {
            const pubkeyHex = txObj.pathMap[paths[i]];
            const publickey = cardano.PublicKey.from_bytes(convertToBuffer(pubkeyHex));
            const signature = cardano.Ed25519Signature.from_hex(signatures[i]);
            const transactionHash = cardano.FixedTransactionBody.from_hex(txObj.rawTx).tx_hash().to_bytes();

            if (!publickey.verify(transactionHash, signature)) {
                logger?.error(`signature error, got signature ${signatures[i]} and publickey ${pubkeyHex}`);
                throw Error(`Signature error on path ${paths[i]}`);
            }

            vkeys.add(cardano.Vkeywitness.new(
                cardano.Vkey.new(publickey),
                signature
            ));
        }

        const witness = cardano.TransactionWitnessSet.new();
        witness.set_vkeys(vkeys);

        const tx = cardano.Transaction.new(txbody, witness);
        if (!tx.is_valid()) {
            logger?.debug(`Cannot finalize transaction, tx: ${txObj.rawTx}\n`);
            for (let i = 0; i < signatures.length; i++) {
                logger?.debug(`path: ${paths[i]}\npubkey: ${txObj.pathMap[paths[i]]}\nsignature: ${signatures[i]}`);
            }

            throw Error("Cannot finalize transaction.");
        }

        return Buffer.from(tx.to_bytes()).toString("base64");
    }

    /**
     * Prepare data for signing.
     * @param {StakeInput} input 
     * @param {string} pool pool hash or id
     * @param {StakeOption} [option] 
     * @returns {prepared}
     */
    static prepareStake(input: StakeInput, pool: string, option?: StakeOption) {
        ow(input, ow_StakeInput);
        ow(pool, ow.any(ow_poolHash, owTool.hexString.length(56)));
        ow(option as StakeOption, ow.any(ow.undefined, ow_StakeOption));


        const stakeIndex = option?.stakeIndex ?? 0;
        const stakeKey = xpubToPublickey(convertToBuffer(input.xpublickey), 2, stakeIndex);
        const stakeCert = cardano.Credential.from_keyhash(
            cardano.PublicKey.from_bytes(stakeKey).hash()
        );

        const certs = cardano.Certificates.new();
        if (option?.needRegistration) {
            certs.add(
                cardano.Certificate.new_stake_registration(cardano.StakeRegistration.new(stakeCert))
            );
        }

        certs.add(cardano.Certificate.new_stake_delegation(
            cardano.StakeDelegation.new(
                stakeCert,
                (pool.startsWith("pool")) ? cardano.Ed25519KeyHash.from_bech32(pool)
                    : cardano.Ed25519KeyHash.from_bytes(Buffer.from(pool, "hex"))
            )
        ));


        const inputs = input.utxo.map(x => ({
            path: input.path,
            xpublickey: input.xpublickey,
            ...x
        }));
        const { builder, paths, publickeys } = CreateBaseTransaction(inputs);
        builder.set_certs(certs);

        // need to sign with stake key
        paths.push(`${input.path}/2/${stakeIndex}`);
        publickeys.push(stakeKey);


        const rawTx = CreateRawTransaction(builder, {
            fee: option?.fee,
            TimeToLive: option?.TimeToLive,
            changeAddress: input.changeAddress
        });
        return CreateCommandData(paths, publickeys, rawTx);
    }

    /**
     * Prepare data for signing.
     * @param {StakeInput} input 
     * @param {UnStakeOption} [option] 
     * @returns {prepared}
     */
    static prepareUnstake(input: StakeInput, option?: UnStakeOption) {
        ow(input, ow_StakeInput);
        ow(option as UnStakeOption, ow.any(ow.undefined, ow_UnStakeOption));


        const stakeIndex = option?.stakeIndex ?? 0;
        const stakeKey = xpubToPublickey(convertToBuffer(input.xpublickey), 2, stakeIndex);
        const stakeCert = cardano.Credential.from_keyhash(
            cardano.PublicKey.from_bytes(stakeKey).hash()
        );

        const certs = cardano.Certificates.new();
        certs.add(cardano.Certificate.new_stake_deregistration(
            cardano.StakeDeregistration.new(stakeCert)
        ));


        const inputs = input.utxo.map(x => ({
            path: input.path,
            xpublickey: input.xpublickey,
            ...x
        }));
        const { builder, paths, publickeys } = CreateBaseTransaction(inputs);
        builder.set_certs(certs);

        if (option?.withdrawAmount) {
            const withdraws = cardano.Withdrawals.new();
            withdraws.insert(
                cardano.RewardAddress.new(
                    option?.network?.id ?? NetworkInfo.mainnet.id,
                    stakeCert
                ),
                cardano.BigNum.from_str(option.withdrawAmount.toString(10))
            );

            builder.set_withdrawals(withdraws);
        }

        // need to sign with stake key
        paths.push(`${input.path}/2/${stakeIndex}`);
        publickeys.push(stakeKey);


        const rawTx = CreateRawTransaction(builder, {
            fee: option?.fee,
            TimeToLive: option?.TimeToLive,
            changeAddress: input.changeAddress
        });
        return CreateCommandData(paths, publickeys, rawTx);
    }

    /**
     * Prepare data for signing.
     * @param {StakeInput} input 
     * @param {string} amount rewards
     * @param {WithdrawOption} [option] 
     * @returns {prepared}
     */
    static prepareWithdraw(input: StakeInput, amount: string, option?: WithdrawOption) {
        ow(input, ow_StakeInput);
        ow(amount, owTool.numberString);
        ow(option as WithdrawOption, ow.any(ow.undefined, ow_WithdrawOption));


        const stakeIndex = option?.stakeIndex ?? 0;
        const stakeKey = xpubToPublickey(convertToBuffer(input.xpublickey), 2, stakeIndex);
        const stakeCert = cardano.Credential.from_keyhash(
            cardano.PublicKey.from_bytes(stakeKey).hash()
        );

        const withdraws = cardano.Withdrawals.new();
        withdraws.insert(
            cardano.RewardAddress.new(
                option?.network?.id ?? NetworkInfo.mainnet.id,
                stakeCert
            ),
            cardano.BigNum.from_str(amount)
        );

        const inputs = input.utxo.map(x => ({
            path: input.path,
            xpublickey: input.xpublickey,
            ...x
        }));
        const { builder, paths, publickeys } = CreateBaseTransaction(inputs);
        builder.set_withdrawals(withdraws);

        // need to sign with stake key
        paths.push(`${input.path}/2/${stakeIndex}`);
        publickeys.push(stakeKey);


        const rawTx = CreateRawTransaction(builder, {
            fee: option?.fee,
            TimeToLive: option?.TimeToLive,
            changeAddress: input.changeAddress
        });
        return CreateCommandData(paths, publickeys, rawTx);
    }

    static prepareVoteDelegation(input: StakeInput, drep: DrepType, option?: WithdrawOption) {
        ow(input, ow_StakeInput);
        ow(drep, ow.number.inRange(0, DrepType.__LENGTH - 1));
        ow(option as WithdrawOption, ow.any(ow.undefined, ow_WithdrawOption));

        const stakeIndex = option?.stakeIndex ?? 0;
        const stakeKey = xpubToPublickey(convertToBuffer(input.xpublickey), 2, stakeIndex);
        const stakeCert = cardano.Credential.from_keyhash(
            cardano.PublicKey.from_bytes(stakeKey).hash()
        );

        let _drep;
        switch (drep) {
            case DrepType.NO:
                _drep = cardano.DRep.new_always_no_confidence();
                break;

            default:
                _drep = cardano.DRep.new_always_abstain();
        }

        const certs = cardano.Certificates.new();
        certs.add(cardano.Certificate.new_vote_delegation(
            cardano.VoteDelegation.new(stakeCert, _drep)
        ));

        const inputs = input.utxo.map(x => ({
            path: input.path,
            xpublickey: input.xpublickey,
            ...x
        }));
        const { builder, paths, publickeys } = CreateBaseTransaction(inputs);
        builder.set_certs(certs);

        // need to sign with stake key
        paths.push(`${input.path}/2/${stakeIndex}`);
        publickeys.push(stakeKey);


        const rawTx = CreateRawTransaction(builder, {
            fee: option?.fee,
            TimeToLive: option?.TimeToLive,
            changeAddress: input.changeAddress
        });
        return CreateCommandData(paths, publickeys, rawTx);
    }

    static async getAddress(this: ITransport, pathWith3Depth: string, type: AddressType, option?: AddressOption) {
        const data = SecuxADA.prepareAddress(pathWith3Depth);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxADA.resolveAddress(rsp, type, option);

        return address;
    }

    static async getPublickey(this: ITransport, path: string, useCIP1852 = true): Promise<string> {
        ow(path, ow_fullPath);

        const elements = path.match(/\d+/g)!;
        const data = SecuxADA.prepareXPublickey(`m/${elements[0]}'/${elements[1]}'/${elements[2]}'`);
        const rsp = await this.Exchange(getBuffer(data));
        const xpublickey = convertToBuffer(SecuxADA.resolveXPublickey(rsp));

        const change = parseInt(elements[3], 10);
        const index = parseInt(elements[4], 10);

        return xpubToPublickey(xpublickey, change, index, useCIP1852).toString("hex");
    }

    static async getXPublickey(this: ITransport, pathWith3Depth: string): Promise<string> {
        const data = SecuxADA.prepareXPublickey(pathWith3Depth);
        const rsp = await this.Exchange(getBuffer(data));
        const xpublickey = SecuxADA.resolveXPublickey(rsp);

        return xpublickey;
    }

    static async sign(this: ITransport, inputs: Array<TxInput>, output: TxOutput, option?: SignOption): Promise<{ raw_tx: string }>
    static async sign(this: ITransport, input: StakeInput, pool: string, option?: StakeOption): Promise<{ raw_tx: string }>
    static async sign(this: ITransport, input: StakeInput, option?: UnStakeOption): Promise<{ raw_tx: string }>
    static async sign(this: ITransport, input: StakeInput, amount: string, option?: WithdrawOption): Promise<{ raw_tx: string }>
    static async sign(this: ITransport, input: StakeInput, drep: DrepType, option?: WithdrawOption): Promise<{ raw_tx: string }>
    static async sign(this: ITransport, ...args: any[]) {
        let func: any = SecuxADA.prepareSign;
        if (Array.isArray(args[0])) {
            const xpubCache: { [path: string]: string } = {};
            for (const txIn of args[0]) {
                ow(txIn.path, ow_path);

                if (!xpubCache[txIn.path]) {
                    xpubCache[txIn.path] = await SecuxADA.getXPublickey.call(this, txIn.path);
                }

                txIn.xpublickey = xpubCache[txIn.path];
            }

            func = SecuxADA.prepareSign;
        }
        else {
            args[0].xpublickey = await SecuxADA.getXPublickey.call(this, args[0].path);

            if (args[1] === undefined || typeof args[1] === "object") {
                func = SecuxADA.prepareUnstake;
            }
            else if (typeof args[1] === "number") {
                func = SecuxADA.prepareVoteDelegation;
            }
            else if (typeof args[1] === "string" && (args[1].startsWith("pool") || args[1].length === 56)) {
                func = SecuxADA.prepareStake;
            }
            else {
                func = SecuxADA.prepareWithdraw;
            }
        }


        const { commandData, serialized } = func(...args);
        const rsp = await this.Exchange(getBuffer(commandData));
        const raw_tx = SecuxADA.resolveTransaction(rsp, serialized);

        return { raw_tx }
    }
}

loadPlugin(SecuxADA, "SecuxADA");


function convertToBuffer(data: string | Buffer) {
    const pk = (typeof data === "string") ? Buffer.from(data, "hex") : data;
    return pk;
}

function xpubToPublickey(xpub: Buffer, change: number, index: number, useCIP1852: boolean = true): Buffer {
    if (useCIP1852) {
        const changeKey = cardanoV1.derivePublic(xpub, change, 2);
        const indexKey = cardanoV1.derivePublic(changeKey, index, 2);

        return Buffer.from(indexKey.slice(0, 32));
    }

    const bip32Pub = cardano.Bip32PublicKey.from_bytes(xpub);

    return Buffer.from(
        bip32Pub.derive(change).derive(index).as_bytes().slice(0, 32)
    );
}


function CreateBaseTransaction(inputs: Array<TxInput>, config?: any) {
    const c = config ?? cardano.__config;
    const builder = cardano.TransactionBuilder.new(c);

    const paths: string[] = [];
    const publickeys: Buffer[] = [];
    for (const txIn of inputs) {
        const index = txIn.addressIndex ?? 0;
        const pk = xpubToPublickey(convertToBuffer(txIn.xpublickey!), 0, index);

        const utxo = cardano.TransactionInput.new(
            cardano.TransactionHash.from_bytes(Buffer.from(txIn.txId, "hex")),
            txIn.index
        );
        const amount = cardano.Value.new(cardano.BigNum.from_str(txIn.amount.toString(10)));

        builder.add_key_input(
            cardano.PublicKey.from_bytes(pk).hash(),
            utxo,
            amount
        );
        paths.push(`${txIn.path}/0/${index}`);
        publickeys.push(pk);
    }

    return { builder, paths, publickeys };
}

function CreateRawTransaction(builder: any, option?: SignOption) {
    if (!option) {
        builder.set_fee(builder.min_fee());
    }
    else {
        if (option.fee)
            builder.set_fee(cardano.BigNum.from_str(option.fee.toString(10)));
        else if (option.changeAddress)
            builder.add_change_if_needed(cardano.Address.from_bech32(option.changeAddress));

        if (option.TimeToLive) builder.set_ttl(option.TimeToLive);
    }

    const rawTx = Buffer.from(builder.build().to_bytes());
    const fee = parseInt(builder.get_fee_if_set()!.to_str(), 10);
    const minFee = calculateFee(rawTx.length);
    if (fee < minFee) throw Error(`minimal transaction fee is ${minFee}, but got ${fee}.`);

    return rawTx;
}

function CreateCommandData(paths: Array<string>, publickeys: Array<Buffer>, rawTx: Buffer): { commandData: communicationData, serialized: communicationData } {
    const pathMap: { [path: string]: string } = {};
    for (let i = 0; i < paths.length; i++) {
        if (pathMap[paths[i]]) continue;

        pathMap[paths[i]] = publickeys[i].toString("hex");
    }

    const pathSet = Object.keys(pathMap);
    const txs = pathSet.map(_ => rawTx);
    const commandData = SecuxTransactionTool.signRawTransactionList(
        pathSet, txs, undefined,
        {
            tp: TransactionType.NORMAL,
            curve: EllipticCurve.ED25519_ADA,
            chainId: 0
        }
    );

    const txObj = {
        rawTx: rawTx.toString("hex"),
        pathMap
    };
    const serialized = Buffer.from(JSON.stringify(txObj));

    return wrapResult({
        commandData,
        serialized: toCommunicationData(serialized)
    });
}

/**
 * Data type for transmission.
 * @typedef {string | Buffer} communicationData
 */

/**
 * Address type. (BASE ~ REWARD: Shelley-type)
 * @typedef {enum} AddressType
 * @property {number} BASE 0
 * @property {number} ENTERPRISE 1
 * @property {number} POINTER 2
 * @property {number} REWARD 3
 * @property {number} BOOTSTRAPv1 4
 * @property {number} BOOTSTRAPv2 5
 */

/**
 * Parameters of Pointer address.
 * @typedef {object} PointerOption
 * @property {number} slot
 * @property {number} txIndex
 * @property {number} certIndex
 */

/**
 * Options for generating address.
 * @typedef {object} AddressOption
 * @property {number} [addressIndex] account index
 * @property {number} [stakeIndex] stake key index
 * @property {PointerOption} [pointer] option for Pointer address
 */

/**
 * The UTXO object.
 * @typedef {object} TxInput
 * @property {string} path 3-depth path of CIP-1852
 * @property {string | Buffer} xpublickey ED25519 publickey from `path`
 * @property {string} txId referenced transaction hash
 * @property {number} index referenced transaction output index
 * @property {number | string} amount referenced transaction output amount
 * @property {number} [addressIndex] default: 0
 * @property {number} [stakeIndex] default: 0
 */

/**
 * The payment object.
 * @typedef {object} TxOutput
 * @property {string} address receiver's address
 * @property {number | string} amount amount of payment
 */

/**
 * Option for payment.
 * @typedef {object} SignOption
 * @property {string} [changeAddress] default: sender's address
 * @property {number | string} [fee]
 * @property {number} [TimeToLive]
 */

/**
 * Option for staking.
 * @typedef {object} StakeOption
 * @property {number} [stakeIndex] default: 0
 * @property {boolean} [needRegistration] include registration or not
 * @property {number | string} [fee]
 * @property {number} [TimeToLive]
 */

/**
 * Option for withdraw rewards.
 * @typedef {object} WithdrawOption
 * @property {number} [stakeIndex] default: 0
 * @property {number | string} [fee]
 * @property {number} [TimeToLive]
 */

/**
 * Option for unstaking. (de-registration)
 * @typedef {object} UnStakeOption
 * @property {number} [stakeIndex] default: 0
 * @property {boolean} [withdrawAmount] withdraw and de-registration
 * @property {number | string} [fee]
 * @property {number} [TimeToLive]
 */

/**
 * @typedef {object} utxo
 * @property {string} txId referenced transaction hash
 * @property {number} index referenced transaction output index
 * @property {number | string} amount referenced transaction output amount
 * @property {number} [addressIndex] default: 0
 */

/**
 * Parameters for staking operations.
 * @typedef {object} StakeInput
 * @property {string} path 3-depth path of CIP-1852
 * @property {Array<utxo>} utxo
 * @property {string} changeAddress owner's account
 * @property {string | Buffer} xpublickey cardano bip32-publickey
 * @property {number} [stakeIndex] default: 0
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {communicationData} commandData data for sending to device
 * @property {communicationData} serialized
 */
