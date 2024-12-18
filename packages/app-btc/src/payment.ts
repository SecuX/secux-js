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


import { bech32, bech32m } from 'bech32';
import { ripemd160, sha256 } from "hash.js";
import { coinmap, CoinType, OPCODES, ScriptType } from './interface';
import { bs58Check } from "@secux/utility/lib/bs58";
import { Logger } from '@secux/utility';
import { toTweakedPublickey } from './utils';
export { PaymentBTC, CoinType, Hash160 };
export const logger = Logger?.child({ id: "payment" });


const SEGWIT_VERSION_DIFF = 0x50;

class PaymentBTC {
    protected static bs58check = new bs58Check(Hash256);

    protected static CoinSupported(coin: CoinType) {
        if (coin === CoinType.BITCOINCASH) throw Error('Please use class PaymentBCH instead');
        if (coin === CoinType.GROESTL) throw Error('Please use class PaymentGRS instead');
    }

    /**
     * Pay to Public Key Hash for BTC compatible coin
     * @param {CoinType} coin 
     * @param {Buffer} opt [publickey | hashed publickey]
     * @returns 
     */
    static p2pkh(coin: CoinType, opt: {
        publickey?: Buffer,
        hash?: Buffer
    }): { address: string, scriptPublickey: Buffer, redeemHash: Buffer } {
        this.CoinSupported(coin);
        if (!opt.publickey && !opt.hash) throw Error('Invalid Parameters');
        if (opt.publickey && opt.hash) throw Error('Invalid Parameters');

        //@ts-ignore
        const pkHash = (opt.hash) ? opt.hash : Hash160(opt.publickey);
        logger?.info(`publickey hash: ${pkHash.toString('hex')}`);

        const network = coinmap[coin];
        const address = this.bs58check.encode(pkHash, Buffer.from([network.pubKeyHash]));

        const op = Buffer.from([OPCODES.OP_DUP, OPCODES.OP_HASH160, 0x14]);
        const check = Buffer.from([OPCODES.OP_EQUALVERIFY, OPCODES.OP_CHECKSIG]);
        const scriptPublickey = Buffer.concat([op, pkHash, check]);

        const redeemHash = Hash160(scriptPublickey);
        logger?.info(`redeem hash: ${redeemHash.toString('hex')}`);

        return { address, scriptPublickey, redeemHash };
    }

    /**
     * Pay to Script Hash for BTC compatible coin
     * @param {CoinType} coin 
     * @param {Buffer} redeemHash 
     * @returns 
     */
    static p2sh(coin: CoinType, redeemHash: Buffer): { address: string, scriptPublickey: Buffer } {
        this.CoinSupported(coin);

        const network = coinmap[coin];
        const address = this.bs58check.encode(redeemHash, Buffer.from([network.scriptHash]));

        const op = Buffer.from([OPCODES.OP_HASH160, 0x14]);
        const check = Buffer.from([OPCODES.OP_EQUAL]);
        const scriptPublickey = Buffer.concat([op, redeemHash, check]);

        return { address, scriptPublickey };
    }

    /**
     * Pay to Witness Public Key Hash
     * @param {CoinType} coin
     * @param {Buffer} opt [publickey | hashed publickey]
     * @returns 
     */
    static p2wpkh(coin: CoinType, opt: { publickey?: Buffer, hash?: Buffer }): { address: string, scriptPublickey: Buffer, redeemHash: Buffer } {
        this.CoinSupported(coin);
        if (!opt.publickey && !opt.hash) throw Error('Invalid Parameters');
        if (opt.publickey && opt.hash) throw Error('Invalid Parameters');

        const pkHash = (opt.hash) ? opt.hash : Hash160(opt.publickey!);
        logger?.info(`publickey hash: ${pkHash.toString('hex')}`);

        let network = coinmap[coin];
        const words = bech32.toWords(pkHash);
        words.unshift(0x00);
        const address = bech32.encode(network.bech32!, words);

        const op = Buffer.from([OPCODES.OP_0, 0x14]);
        const scriptPublickey = Buffer.concat([op, pkHash]);

        const redeemHash = Hash160(scriptPublickey);
        logger?.info(`redeem hash: ${redeemHash.toString('hex')}`);

        return { address, scriptPublickey, redeemHash };
    }

    /**
     * Pay to Witness Script Hash
     * @param {CoinType} coin
     * @param {Buffer} opt [witness | hashed redeem]
     * @returns 
     */
    static p2wsh(coin: CoinType, opt: { witness?: Array<Buffer>, hash?: Buffer }): { address: string, scriptPublickey: Buffer, redeemHash: Buffer } {
        this.CoinSupported(coin);
        if (!opt.witness && !opt.hash) throw Error('Invalid Parameters');

        const redeemHash = (opt.hash) ? opt.hash : Sha256(opt.witness![opt.witness!.length - 1]);
        logger?.info(`redeem hash: ${redeemHash.toString('hex')}`);

        let network = coinmap[coin];
        const words = bech32.toWords(redeemHash);
        words.unshift(0x00);
        const address = bech32.encode(network.bech32!, words);

        const op = Buffer.from([OPCODES.OP_0, 0x20]);
        const scriptPublickey = Buffer.concat([op, redeemHash]);

        return { address, scriptPublickey, redeemHash };
    }

    /**
     * Pay to MultiSig
     * @param {number} m 
     * @param {Array<Buffer>} publickeys 
     * @returns 
     */
    static p2ms(m: number, publickeys: Array<Buffer>): { redeem: Buffer, scriptPubicKey: Buffer } {
        if (m <= 0) throw Error('Invalid paramter \"m\"');

        m = m + OPCODES.OP_INT_BASE;
        const n = publickeys.length + OPCODES.OP_INT_BASE;
        const multi_pk = Buffer.concat(publickeys);

        const redeem = Buffer.concat([
            Buffer.from([m]),
            multi_pk,
            Buffer.from([n]),
            Buffer.from([OPCODES.OP_CHECKMULTISIG])
        ]);
        const redeemHash = Hash160(redeem);
        logger?.info(`redeem hash: ${redeemHash.toString('hex')}`);

        const op = Buffer.from([OPCODES.OP_HASH160, 0x14]);
        const check = Buffer.from([OPCODES.OP_EQUAL]);
        const scriptPubicKey = Buffer.concat([
            op,
            redeemHash,
            check
        ]);

        return { redeem, scriptPubicKey };
    }

    static p2tr(coin: CoinType, opt: { publickey?: Buffer, hash?: Buffer }) {
        this.CoinSupported(coin);
        if (!opt.publickey && !opt.hash) throw Error('Invalid Parameters');
        if (opt.publickey && opt.hash) throw Error('Invalid Parameters');

        let tweaked: any = opt.hash;
        if (tweaked === undefined) {
            tweaked = toTweakedPublickey(opt.publickey!);
        }

        const version = 1;
        const network = coinmap[coin];
        const words = bech32.toWords(tweaked);
        words.unshift(version);
        const address = bech32m.encode(network.bech32!, words);

        // witness v1 | PUSH_DATA 32 bytes
        const header = Buffer.from([SEGWIT_VERSION_DIFF + version, 0x20]);
        const scriptPublickey = Buffer.concat([header, tweaked]);

        return { address, scriptPublickey };
    }

    /**
     * decode address to script
     * @param {CoinType} coin
     * @param {string} address 
     */
    static decode(coin: CoinType, address: string): Buffer {
        const network = coinmap[coin];

        // segwit address, bech32/bech32m is case insensitive
        if (network.bech32 && RegExp(`^${network.bech32}`, "i").test(address)) {
            const trimmed = address.slice(network.bech32.length + 1);
            let result;
            switch (trimmed[0]) {
                case 'p':
                    result = bech32m.decode(address);
                    break;

                default:
                    result = bech32.decode(address);
                    break;
            }

            const version = result.words.shift();
            switch (version) {
                case 0:
                    const hash160 = Buffer.from(bech32.fromWords(result.words));
                    logger?.debug(`bech32 address: ${address}\nbech32 decoded: ${hash160.toString("hex")}`);

                    if (hash160.length == 20) return this.p2wpkh(coin, { hash: hash160 }).scriptPublickey;
                    if (hash160.length == 32) return this.p2wsh(coin, { hash: hash160 }).scriptPublickey;
                case 1:
                    const tweaked = Buffer.from(bech32m.fromWords(result.words));
                    logger?.debug(`bech32m address: ${address}\nbech32m decoded: ${tweaked.toString("hex")}`);
                    return this.p2tr(coin, { hash: tweaked }).scriptPublickey;

                default:
                    throw Error(`ArgumentError: unsupported witness version, got "${version}" from address "${address}"`);
            }
        }

        try {
            const hash160 = this.bs58check.decode(address);
            const prefix = hash160[0];
            const hash = hash160.slice(1);

            if (prefix === network.scriptHash) return this.p2sh(coin, hash).scriptPublickey;
            if (prefix === network.pubKeyHash) return this.p2pkh(coin, { hash }).scriptPublickey;
        }
        catch (error: any) {
            logger?.debug(`${error.toString()}, cointype: ${CoinType[coin]}, address: ${address}`);
        }
        
        throw Error(`ArgumentError: invalid address for ${CoinType[coin]}, got ${address}`);
    }

    static classify(script: Buffer): ScriptType {
        if (this.isP2WPKH(script)) return ScriptType.P2WPKH;
        if (this.isP2PKH(script)) return ScriptType.P2PKH;
        if (this.isP2TR(script)) return ScriptType.P2TR;
        if (this.isP2WSH(script)) return ScriptType.P2WSH;

        throw Error(`non-standard script: ${script.toString("hex")}`);
    }

    static isP2PKH(script: Buffer): boolean {
        if (
            script.length !== 25 ||
            script[0] !== OPCODES.OP_DUP ||
            script[1] !== OPCODES.OP_HASH160 ||
            script[2] !== 0x14 ||
            script[23] !== OPCODES.OP_EQUALVERIFY ||
            script[24] !== OPCODES.OP_CHECKSIG
        )
            return false;

        return true;
    }

    static isP2SH(script: Buffer): boolean {
        if (
            script.length !== 23 ||
            script[0] !== OPCODES.OP_HASH160 ||
            script[1] !== 0x14 ||
            script[22] !== OPCODES.OP_EQUAL
        )
            return false;

        return true;
    }

    static isP2WPKH(script: Buffer): boolean {
        if (
            script.length !== 22 ||
            script[0] !== OPCODES.OP_0 ||
            script[1] !== 0x14
        )
            return false;

        return true;
    }

    static isP2WSH(script: Buffer): boolean {
        if (
            script.length !== 34 ||
            script[0] !== OPCODES.OP_0 ||
            script[1] !== 0x20
        )
            return false;

        return true;
    }

    static isP2TR(script: Buffer): boolean {
        if (
            script.length !== 34 ||
            script[0] !== SEGWIT_VERSION_DIFF + 1 ||
            script[1] !== 0x20
        )
            return false;

        return true;
    }
}


function Sha256(data: Buffer): Buffer {
    const sha = sha256().update(data).digest();
    return Buffer.from(sha);
}

function Hash160(publickey: Buffer): Buffer {
    const sha = Sha256(publickey);
    return Buffer.from(ripemd160().update(sha).digest());
}

function Hash256(data: Buffer): Buffer {
    const sha1 = Sha256(data);
    const sha2 = Sha256(sha1);
    return sha2;
}
