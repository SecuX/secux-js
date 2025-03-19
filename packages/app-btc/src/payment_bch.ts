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


const cashaddr = require('cashaddrjs');
import { PaymentBTC, CoinType, Hash160, logger } from './payment';
import { OPCODES } from './interface';
export { PaymentBCH, CoinType };


class PaymentBCH extends PaymentBTC {
    protected static CoinSupported(coin: CoinType) {
        if (coin !== CoinType.BITCOINCASH) throw Error('Not supported cointype');
    }

    /**
     * Pay to Public Key Hash for BITCOINCASH
     * @param {CoinType} coin 
     * @param {Buffer} param1 [publickey | hashed publickey]
     * @returns 
     */
    static p2pkh(coin: CoinType, opt: {
        publickey?: Buffer,
        hash?: Buffer
    }): { address: string, scriptPublickey: Buffer } {
        this.CoinSupported(coin);
        if (!opt.publickey && !opt.hash) throw Error('Invalid Parameters');
        if (opt.publickey && opt.hash) throw Error('Invalid Parameters');

        //@ts-ignore
        const pkHash = (opt.hash) ? opt.hash : Hash160(opt.publickey);
        logger?.info(`publickey hash: ${pkHash.toString('hex')}`);

        // FIXME: no fixed params
        let address = cashaddr.encode('bitcoincash', 'P2PKH', pkHash);
        address = address.split(':')[1];

        const op = Buffer.from([OPCODES.OP_DUP, OPCODES.OP_HASH160, 0x14]);
        const check = Buffer.from([OPCODES.OP_EQUALVERIFY, OPCODES.OP_CHECKSIG]);
        const scriptPublickey = Buffer.concat([op, pkHash, check]);

        return { address, scriptPublickey };
    }

    /**
     * Pay to Script Hash for BITCOINCASH
     * @param {CoinType} coin 
     * @param {Buffer} opt [redeemScript | hashed redeem]
     * @returns 
     */
    static p2sh(coin: CoinType, opt: { redeemScript?: Buffer, hash?: Buffer }): { address: string, scriptPublickey: Buffer } {
        this.CoinSupported(coin);
        if (!opt.redeemScript && !opt.hash) throw Error('Invalid Parameters');

        const redeemHash = (opt.hash) ? opt.hash : Hash160(opt.redeemScript!);
        logger?.info(`redeem hash: ${redeemHash.toString('hex')}`);

        let address = cashaddr.encode('bitcoincash', 'P2SH', redeemHash);
        address = address.split(':')[1];

        const op = Buffer.from([OPCODES.OP_HASH160, 0x14]);
        const check = Buffer.from([OPCODES.OP_EQUAL]);
        const scriptPublickey = Buffer.concat([op, redeemHash, check]);

        return { address, scriptPublickey };
    }

    /**
     * decode address to script
     * @param {string} address 
     */
    static decode(coin: CoinType, address: string): Buffer {
        if (address.startsWith('1')) {
            const hash160 = this.bs58check.decode(address);
            const hash = Buffer.from(hash160.slice(1));

            return PaymentBCH.p2pkh(coin, { hash }).scriptPublickey;
        }
        else {
            address = (CheckPrefix(address)) ? address : `bitcoincash:${address}`;
            const { hash, type } = cashaddr.decode(address);

            switch (type) {
                case "P2SH":
                    return PaymentBCH.p2sh(coin, { hash: Buffer.from(hash) }).scriptPublickey;

                default:
                    return PaymentBCH.p2pkh(coin, { hash: Buffer.from(hash) }).scriptPublickey;
            }
        }
    }
}

function CheckPrefix(address: string) {
    const regexp = /^(?:bitcoincash|bchtest):q.+/;

    return regexp.test(address);
}