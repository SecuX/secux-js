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


export interface Network {
    messagePrefix: string;
    bech32?: string;
    bip32: Bip32;
    pubKeyHash: number;
    scriptHash: number;
    wif: number;
    coinType: number;
}

export interface Bip32 {
    public: number;
    private: number;
}

export const bitcoin: Network = Object.freeze({
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coinType: 0,
});

export const testnet: Network = Object.freeze({
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coinType: 1,
});

export const regtest: Network = Object.freeze({
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bcrt',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coinType: 1,
});

export const litecoin: Network = Object.freeze({
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'ltc',
    bip32: {
        public: 0x019da462,
        private: 0x019d9cfe
    },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
    coinType: 2,
});

export const bitcoincash: Network = Object.freeze({
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coinType: 145,
});

export const groestl: Network = Object.freeze({
    messagePrefix: '\x1CGroestlCoin Signed Message:\n',
    bech32: 'grs',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4
    },
    pubKeyHash: 0x24,
    scriptHash: 0x05,
    wif: 0x80,
    coinType: 17,
});

export const digibyte: Network = Object.freeze({
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'dgb',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4
    },
    pubKeyHash: 0x1e,
    scriptHash: 0x3f,
    wif: 0x80,
    coinType: 20,
});

export const dash: Network = Object.freeze({
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'dash',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4
    },
    pubKeyHash: 0x4c,
    scriptHash: 0x10,
    wif: 0xcc,
    coinType: 5,
});

export const dogecoin: Network = Object.freeze({
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'doge',
    bip32: {
        public: 0x02facafd,
        private: 0x02fac398
    },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
    coinType: 3,
});

export const OPCODES = Object.freeze({
    OP_0: 0x00,
    OP_PUSHDATA1: 0x4c,
    OP_PUSHDATA2: 0x4d,
    OP_PUSHDATA4: 0x4e,
    OP_1NEGATE: 0x4f,
    OP_INT_BASE: 0x50,
    OP_DUP: 0x76,
    OP_HASH160: 0xa9,
    OP_EQUAL: 0x87,
    OP_EQUALVERIFY: 0x88,
    OP_CODESEPARATOR: 0xab,
    OP_CHECKSIG: 0xac,
    OP_CHECKMULTISIG: 0xae,
    OP_RETURN: 0x6a
});
