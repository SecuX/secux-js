const { SecuxBTC, CoinType, ScriptType } = require("@secux/app-btc");
const { getDefaultScript } = require("@secux/app-btc/lib/utils");
const btc = require("bitcoinjs-lib");
const { validate } = require("multicoin-address-validator");
const { txCheck, decode } = require("./decoder");
const { ECPair } = require("ecpair");
const { assert } = require("chai");
const randomBytes = require("randombytes");


const BLACKBOX = false;
const BROADCAST = false;
export function test_address(GetDevice, root) {
    describe("BTC address", () => {
        describe("native segwit address", () => {
            const path = `m/84'/0'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const expected = btc.payments.p2wpkh({ pubkey: child.publicKey, network: btc.networks.bitcoin }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxBTC.prepareAddress(path, { coin: CoinType.BITCOIN, script: ScriptType.P2WPKH });
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("bc1q"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address);

                assert.equal(type, ScriptType.P2WPKH);
            });

            it("can derive address", async () => {
                const zpub = "zpub6qXWDwr8vMMMCCN6ep7SV8MWSzsTdX62fcbdcQDywo9cYmC5cFrHJwsxUD1JEVmFu3SpoYb4R6TotpB7h2WxULu1o2sVrERGz8mekTPHNJ5";
                const test = [
                    { address: "bc1qnqqpnffkad3px7nefpg4c90z96qglm27nl4zma", change: 0, index: 0 },
                    { address: "bc1q3jzc8de3s5m864lsppqucsxfpde6tdpl38nfxt", change: 0, index: 1 },
                    { address: "bc1qd0fnxad8589ptqg30868jn94d6atqlzhwxry57", change: 0, index: 2 },
                    { address: "bc1qnj5qlene690sd27kkv80y5um2h4uk8gzpdrddh", change: 0, index: 3 },
                    { address: "bc1q6x502m9r4vtpj82vjdjdshdw25gxmx7xyqdf69", change: 0, index: 4 },
                    { address: "bc1qwu0sffhul768z3uevhvt84j9l2k0pgdjlphwrc", change: 1, index: 0 },
                    { address: "bc1qa8r946fh9gnnr2sa6c5yleumymddh0x523626p", change: 1, index: 1 },
                    { address: "bc1qqnn9rqwwywj6zl2wker42sq3vwldcdnlfdg3yn", change: 1, index: 2 },
                    { address: "bc1qwpgvc4hujz6aac2c7np3g7yh0vjdg8y536m0f8", change: 1, index: 3 },
                    { address: "bc1q0jm45zq6zeppy0qpzykessdpz2nlw7464lt62w", change: 1, index: 4 },
                ];

                for (const _ of test) {
                    const address = SecuxBTC.deriveAddress(zpub, _.change, _.index, {
                        // coin: CoinType.BITCOIN,
                        // script: ScriptType.P2WPKH
                    });

                    assert.equal(address, _.address);
                }
            });
        });

        describe("segwit address", () => {
            const path = `m/49'/0'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const p2wpkh = btc.payments.p2wpkh({ pubkey: child.publicKey, network: btc.networks.bitcoin });
            const expected = btc.payments.p2sh({ redeem: p2wpkh, network: btc.networks.bitcoin }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxBTC.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("3"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address);

                assert.equal(type, ScriptType.P2SH);
            });

            it("can derive address", () => {
                const ypub = "ypub6X4fvckSrXb2fR6eR8Hq1bEWsvs36JiyZbn89WJTq3nyERbroaf1MGvat6AisWdtH1v3fq2HVrSHDMBhgEm5raXKp3dhGhUy4ed7XiXYAZb";
                const test = [
                    { address: "3HrWdvTi1167JPXFXcXrm2K3BPp3e9HM4k", change: 0, index: 0 },
                    { address: "39YEWbD2VmBUqg33nmPm2B5u5XCV3NZbgL", change: 0, index: 1 },
                    { address: "3BbpLrc18E1XbTFbwetBuQnsFbkUCMcyKf", change: 0, index: 2 },
                    { address: "3Jyz762242rmYd9B6J1d8JCUFpQu3Fsnys", change: 0, index: 3 },
                    { address: "353KXgM3CY1mCfk7gUeYb1osn9315rChMb", change: 0, index: 4 },
                    { address: "34DoLJFpYxmyoSc7cDitTL11h6FCLkYcj2", change: 1, index: 0 },
                    { address: "3Epd5gfruDpqMas5vLyFzvBp7JnkiZc8JP", change: 1, index: 1 },
                    { address: "3NaPCHYg6D5rNpqYi4A5DXrQDkpJmha8Hr", change: 1, index: 2 },
                    { address: "3P7BE5oMPmAxdvkda1KYXmSTrbfFrXvoBp", change: 1, index: 3 },
                    { address: "3B4m25wtxbAwBb83cddpDhHKVPiRqfwF5u", change: 1, index: 4 },
                ];

                for (const _ of test) {
                    const address = SecuxBTC.deriveAddress(ypub, _.change, _.index, {
                        // coin: CoinType.BITCOIN,
                        // script: ScriptType.P2SH_P2WPKH
                    });

                    assert.equal(address, _.address);
                }
            });
        });

        describe("legacy address", () => {
            const path = `m/44'/0'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = btc.payments.p2pkh({ pubkey: child.publicKey, network: btc.networks.bitcoin }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxBTC.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("1"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address);

                assert.equal(type, ScriptType.P2PKH);
            });

            it("can derive address", () => {
                const xpub = "xpub6C4EasnRfRhoKDVzCxAZbwwmnoutCvmNo9wHLm49cVP1D3P9zakqLFKMM4vXjQRPLVYQaKMbc6QmSvfRx486dWA9BnBB4sPqDda3BpyDxuD";
                const test = [
                    { address: "19RJ1JTm7qkLeC5pCRPwsc7Ynx9eijZbvQ", change: 0, index: 0 },
                    { address: "1Hf8TneEyThnGY44YNjWrZsDWYu7xzrSei", change: 0, index: 1 },
                    { address: "18TB7SYVvVUmoguocCdNFbx16domXvnaKo", change: 0, index: 2 },
                    { address: "114nSNUpiEdug38TeUpyxLF7jjXmRGjkPB", change: 0, index: 3 },
                    { address: "1AMHhh4vprTRp3EQF8d6JxcgML5QVDq5ZF", change: 0, index: 4 },
                    { address: "1Ag8HR2BfypnV5k92iDoVN4kCeM6wDzZva", change: 1, index: 0 },
                    { address: "1PWsXSEjqGpDEWCHULp2bodQF9zRzt3uXB", change: 1, index: 1 },
                    { address: "1HHBjzVNkpuTyPm576XnxWaaJbEwVHnqDz", change: 1, index: 2 },
                    { address: "1E3z5xewHSTm9FBodwjAjQSCJEFA4Y9mBB", change: 1, index: 3 },
                    { address: "1AyScee7ZpYQADG3KkrUZREbY5bWoenUa7", change: 1, index: 4 },
                ];

                for (const _ of test) {
                    const address = SecuxBTC.deriveAddress(xpub, _.change, _.index, {
                        // coin: CoinType.BITCOIN,
                        // script: ScriptType.P2PKH
                    });

                    assert.equal(address, _.address);
                }
            });
        });

        describe("tweaked p2tr key-spend only address", () => {
            const path = `m/86'/0'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            let expected;
            before(async () => {
                expected = btc.payments.p2tr({ internalPubkey: child.publicKey.slice(1, 33) }).address;
            });

            let address;
            it("query address from device", async () => {
                const data = SecuxBTC.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("bc1p"), true);
            });

            it("can derive address", async () => {
                const xpub = "xpub6CY4pXQ1CvuxcnVYrMnrojzNbUqDuCCATSUehzPXZCjczVtVehy25tTauPvWGHeKKmgcN4pMFqSK8LjGvKNxjbwb91kEzrN5fKt14HZEyHA";
                const test = [
                    { address: "bc1ptce7u7rvl2496l904jl8hlwm9g9tpk63wfdv7hpa6q0x84q3n0ush52ezs", change: 0, index: 0 },
                    { address: "bc1p7jvmy4ntena33fyzjpnvp33vkfyddtlhzrvlezaf9xr57j3zfl4qj2ujxj", change: 0, index: 1 },
                    { address: "bc1p8m83q6h3sq55sgvsjkej3z3cwf36sa0zhmvm4amh5e27dyl485ts7544vk", change: 0, index: 2 },
                    { address: "bc1pa3r57nvx9mehdxq3rauug3ulf6rlujg5s9j2nn4glwrrncj0ksvsv5cx2g", change: 0, index: 3 },
                    { address: "bc1p2jaaak7u6cqdw3gmp8q27s94cvxtxhmylzd8vrv5a47v6zqgjsxsu4zjfu", change: 0, index: 4 },
                    { address: "bc1pxxfl3qay9vcnvgpl2jxtp4emtfunna2r9zj9s528cgxhwd6fa5nssfvq4l", change: 1, index: 0 },
                    { address: "bc1pm9756h8kzn4ap5h6lhft3jt9rec3x7syv0xlvzr2z5x04du90m0qnsrp8g", change: 1, index: 1 },
                    { address: "bc1p2py8h76mufna2ryfj2p4rpfk8t9rng0urhs73ttj7dppgew6sr6s7v862m", change: 1, index: 2 },
                    { address: "bc1pm9fx4ann9cwz2g6acfnrujyy9fdvevenwjkzh46swj3mnwj2ufhsvjsc08", change: 1, index: 3 },
                    { address: "bc1px4ck4h9r28sra4q2ew030kx43etclupjneywwcnctrakdjc085tswyekyv", change: 1, index: 4 },
                ];

                for (const _ of test) {
                    const address = SecuxBTC.deriveAddress(xpub, _.change, _.index, {
                        // coin: CoinType.BITCOIN,
                        script: ScriptType.P2TR
                    });

                    assert.equal(address, _.address);
                }
            });
        });
    });
}

export function test_tx(GetDevice, root) {
    describe("BTC transaction", () => {
        describe("p2pkh with RBF", () => {
            const inputs = [
                {
                    hash: "0b062e71e165fba9634d9fb1b5ba703e774bf374815b1f5a617c8d1e7d43dc01",
                    vout: 0,
                    txHex: "0100000001b103a004f672080ceae8277e83c296b5ac090ae78157979211da3e2d41399d1b010000006b483045022100f19d88e6a17789dc399ff2a93b4516bb44af32928d4986138f1a4f7f37ab277b022046fc14c958bc8aa97fea1d2fbf80982534cf51634d46c4d5178e5ca6698bca07012102f8667cfb5b80c3695e3f0c9078589cb04e8d15e71bdae89ebf24b82f9d663d5cffffffff02bc020000000000001976a9145c592f40134c6179a1ce5b06b28d5c2ae443113188ac00040000000000001976a9146d65ced4ef49e23cdbb4be9d510b38e5be28e10688ac00000000",
                    satoshis: 700,
                    path: "m/44'/0'/0'/0/0"
                },
                {
                    hash: "a8c401f524fe7dc4f894b71cd64febed5b553ef5a72fd74a95d9f223f72618d6",
                    vout: 0,
                    txHex: "01000000016d30aeabd11f1fee51b8e1050dae5228c180b85b06818bfb599dae8d950e7eb4010000006b483045022100975f9837d1bf2b5bcc09a75d74ddeca2e845acee4f67bfb4070c8550adf1b44002202f27f59813387e1178f0395395c5bd2752306766234ed8b234abdf0835593d840121035448ae02dcd6829f8c8019e4915e93e8b56a926b0c2acb84de83e9a1c7e6594dffffffff02e8030000000000001976a9145c592f40134c6179a1ce5b06b28d5c2ae443113188acc8b90200000000001976a9148f2a1ea46a4fefc0f7cfa1de8b4cd2969f575d0088ac00000000",
                    satoshis: '1000',
                    path: "m/44'/0'/0'/0/0"
                }
            ];
            const outputs = [
                {
                    address: "3HrWdvTi1167JPXFXcXrm2K3BPp3e9HM4k",
                    satoshis: 100
                },
                {
                    path: "m/44'/0'/0'/0/0",
                    satoshis: 1500
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (const x of inputs) {
                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                for (const x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                signed = await sign(GetDevice(), inputs, outputs, { feeRate: 1, isRBF: true });

                assert.exists(signed);
            }).timeout(20000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const raw_tx = await sign_hook(GetDevice(), inputs, outputs, { feeRate: 1, isRBF: true });

                assert.equal(raw_tx, signed);
            }).timeout(20000);

            it("check raw data of signed transaction", async () => {
                outputs[1].satoshis = 1227;
                const expected = getSignedTX(root, inputs, outputs, true);

                txCheck(signed, expected, inputs, outputs);
            }).timeout(20000);

            it("should fail with fee insufficient", async () => {
                try {
                    outputs[1].satoshis = 9999;
                    await sign_hook(GetDevice(), inputs, outputs);
                } catch (error) { return; }

                assert.fail();
            }).timeout(20000);
        });

        describe("p2sh(p2wpkh)", () => {
            const inputs = [
                {
                    hash: "a817d17087d860d6c4553d77c178fecc6d1f3380b6bdd93e4d9e77de6c9b9330",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "0100000000010286091fe9ffa4547fb04f46c6688cf403ccdac67d3ac845bae797e915c6c5a62600000000171600144b021e734ceacb73cf882c1b005b3e33362a7cbfffffffff6d5db08ff4fef23ed84e8f81ebd682a6a634143eccfa956c68f4d2ccaf4d6d640000000017160014d602f143f5b8ce86ae53f55b13cf173265f20ff2ffffffff02102700000000000017a914b14db996e5c602701e0a0ba75032ae6e0f164c5387775100000000000017a9149009e51f784ddc70059eb31ba8aff2635fa49efa8702483045022100c69d4fac75a743a0ba86e91647a3cd97fb61c5f6bd74954ea40aa0c41e2a883e02207f4401ec1509077b07945152a16effdcbaf2f1d034d05770293b920f39170cb801210241969f2aaf1399b3500f400b0fb35a7c94ac59f202a565130207ee2d8e6740ea02483045022100dc2bac35456be5132a81e1a9780ab8d0d3c0266d8b405b779a6d3ff653c9640a0220316226bd9a4ff74e7e968352431dcb89cd878711db0064da841a8a4b0adc1b500121029936e65b71bf6e08c5d3a47c7f7b15bac522e657c05ba73c16de5367c86b3c8a00000000",
                    script: ScriptType.P2SH_P2WPKH,
                    satoshis: 10000,
                    path: "m/49'/0'/0'/0/0"
                },
                {
                    hash: "07ad0a13e501d292bc8b9e16a3a8b62f99f77ab9e37ea8d3b8453984a2899984",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "01000000000101dfbe0a20f4c5bb77019c02aa546cdc5f9140a7de120d07ca9f1eab739228a1200100000017160014604ca519a42dd6c8228e070b0dfd81f64d26bb81ffffffff02701700000000000017a914b14db996e5c602701e0a0ba75032ae6e0f164c538799bc00000000000017a9147b70abf259a0222f041d826a0a826b574aeb39ef8702483045022100903f20df7f452b44b2b0e0a65b0d41af1f65e45a2d260799bedab34f8eb0852102200997906964aa1a926153bc805d9c12110dcfa1384596fdc89bab549bfe89762601210304f3a1ef7b3b7eb6a184f9b4b3d45ab6bfc486a7c787c84593377691ba9eba1500000000",
                    script: ScriptType.P2SH_P2WPKH,
                    satoshis: 6000,
                    path: "m/49'/0'/0'/0/0"
                },
                {
                    hash: "20a1289273ab1e9fca070d12dea740915fdc6c54aa029c0177bbc5f4200abedf",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "010000000001014975ac8ac93955cc8b602ed7f10c6ed22ac70450e6a0c8c80bc35cce0c20c2020100000017160014604ca519a42dd6c8228e070b0dfd81f64d26bb81ffffffff02204e00000000000017a914b50ba89aedac3b0e430686c69a8704a5f968af7887b9dd00000000000017a914c584c16c3a72840b4f488c6da78538c9cd455d6f8702473044022010ad40322731bd89e57317523ca6a6ead15e6eb0eab537a7eb2dabb4f9fa643602207d131f579f139a63120e80303c81728507607bed91559e9e90f0e42fbdb5c1ab01210304f3a1ef7b3b7eb6a184f9b4b3d45ab6bfc486a7c787c84593377691ba9eba1500000000",
                    script: ScriptType.P2SH_P2WPKH,
                    satoshis: 20000,
                    path: "m/49'/0'/1'/0/0"
                },
            ];
            const outputs = [
                {
                    address: "19RJ1JTm7qkLeC5pCRPwsc7Ynx9eijZbvQ",
                    satoshis: 100
                },
                {
                    script: ScriptType.P2SH_P2WPKH,
                    path: `m/49'/0'/0'/0/${RandomNumber(20)}`,
                    satoshis: 35900,
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                signed = await sign(GetDevice(), inputs, outputs, { feeRate: 1 });

                assert.exists(signed);
            }).timeout(20000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const raw_tx = await sign_hook(GetDevice(), inputs, outputs, { feeRate: 1 });

                assert.equal(raw_tx, signed);
            }).timeout(20000);

            it("check raw data of signed transaction", async () => {
                outputs[1].satoshis = 35550;
                const expected = getSignedTX(root, inputs, outputs);

                txCheck(signed, expected, inputs, outputs);
            }).timeout(20000);
        });

        describe("p2wpkh", () => {
            const inputs = [
                {
                    hash: "8686aee2b9dcf559798b9718ed26ca92e0c64bef11c433e576cae658678c497d",
                    vout: 1,
                    // can ignore "txHex" for P2WPKH
                    txHex: "01000000000103de969082d54bf271a31ef47a28fb38b980c21bc6506c9cf5a050d568f798e9c80000000017160014ba24c6f5fc41734c407372ecc754ff6afcbdc903ffffffff291a80351171ce9ef055f4373f582df51d4223def35bc05ed2cd3586f5b763dc0100000017160014dbccf4b8cfaf01e96f5a0832f086eed6b34ed0c4ffffffffa448f465c3ac975c391ce37f16f003767dae6e0d038b839c4acd056ccc2d349a00000000171600140b6c343f494384c2da5f175f279c62998e6b458effffffff02580200000000000017a914b14db996e5c602701e0a0ba75032ae6e0f164c53873b04000000000000160014771f04a6fcffb471479965d8b3d645faacf0a1b202473044022048d587d85ea5e47f953bcb6f6f9ddca5999e12bc6d32ccdc3b7ccd38881ad69002202549308a2071d26c6444dd1b8e437e23edd8b922b129182625223e18ea40d8e70121026924dfa245ae9d1e97f47f797458701b23b89e8afcd361f67cfdb62909989a8f02483045022100b686dc1571c025f3e2043b6d35df8dd09519bbfbf7c343248f7545f767d35eff02202bf4f2d265a40d2ae5d70fdc83573d5d04f9019fa0679846d9fb2a8bf126c0ae012102814dae0a85e5864e80832cce263c6caaa0db5d0d524ef3b34c65f9636baa01430247304402202968540a0312d30e15dd20af54dbf28f1fd3901821f9a85ea5535cb4b5868c3c02207d9947c5eec2247b671ab6060506cef8408e29e2bbdc8b97313141f91355d107012103f5f8f10277062a7d8f0f65fd9997a74fd4d94be0a5c0b2e148ac2f377cb33ec800000000",
                    satoshis: 1083,
                    path: "m/84'/0'/0'/1/0"
                }
            ];
            const outputs = [
                {
                    // address: "3HrWdvTi1167JPXFXcXrm2K3BPp3e9HM4k",
                    path: `m/84'/0'/0'/0/0`,
                    satoshis: 500
                },
                {
                    path: `m/84'/0'/0'/0/0`,
                    satoshis: 50
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                signed = await sign(GetDevice(), inputs, outputs);

                assert.exists(signed);
            }).timeout(20000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const raw_tx = await sign_hook(GetDevice(), inputs, outputs);

                assert.equal(raw_tx, signed);
            }).timeout(20000);

            it("check raw data of signed transaction", async () => {
                const expected = getSignedTX(root, inputs, outputs);

                txCheck(signed, expected, inputs, outputs);
            }).timeout(20000);
        });

        describe("p2tr", () => {
            const inputs = [
                {
                    hash: "8686aee2b9dcf559798b9718ed26ca92e0c64bef11c433e576cae658678c497d",
                    vout: 1,
                    satoshis: 1131,
                    path: "m/86'/0'/0'/0/1"
                }
            ];
            const outputs = [
                {
                    address: "bc1qs0k3ekx0z7a7yuq3lse7prw373s8cr8lhxvccd",
                    satoshis: 500
                },
                {
                    path: `m/49'/0'/0'/0/0`,
                    satoshis: 50
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                signed = await sign(GetDevice(), inputs, outputs);

                assert.exists(signed);
            }).timeout(20000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const raw_tx = await sign_hook(GetDevice(), inputs, outputs);

                assert.equal(raw_tx, signed);
            }).timeout(20000);

            it("check raw data of signed transaction", async () => {
                const expected = getSignedTX(root, inputs, outputs);

                assert.equal(signed, expected);
            });
        });

        describe("custom test", () => {
            const input_types = ["p2pkh", "p2sh_p2wpkh", "p2wpkh"];
            const recv_type = "p2tr";
            const change_type = "p2wpkh";

            const utxos = getUTXOs(input_types, 5);
            const amount = utxos.reduce((total, x) => total + x.satoshis, 0) - utxos.length * 300;
            const send = Math.ceil(Math.random() * amount);
            const to = {
                path: `m/${getPurpose(recv_type)}'/0'/${RandomNumber(10)}'/${RandomNumber(2)}/${RandomNumber(20)}`,
                satoshis: send,
            };
            const change = {
                path: `m/${getPurpose(change_type)}'/0'/${RandomNumber(10)}'/0/${RandomNumber(20)}`,
                satoshis: amount - send,
            };


            let signed;
            it(`can sign`, async () => {
                signed = await sign_hook(GetDevice(), utxos, [to, change]);
            }).timeout(120000);

            it("check signed transaction", async () => {
                const expected = getSignedTX(root, utxos, [to, change]);

                assert.equal(signed, expected);
            });
        });

        if (BLACKBOX) {
            describe("multi-type", () => {
                const types = ["p2pkh", "p2sh_p2wpkh", "p2wpkh", "p2tr"];
                const nonTaproots = ["p2pkh", "p2sh_p2wpkh", "p2wpkh"];
                const combination = getCombinations(nonTaproots);
                combination.push(["p2tr"]);

                describe("send all", () => {
                    for (const send_types of combination) {
                        for (const recv_type of types) {
                            const utxos = getUTXOs(send_types, 2);
                            const amount = utxos.reduce((total, x) => total + x.satoshis, 0) - utxos.length * 300;
                            const to = {
                                path: `m/${getPurpose(recv_type)}'/0'/${RandomNumber(10)}'/${RandomNumber(2)}/${RandomNumber(20)}`,
                                satoshis: amount,
                            };

                            let signed;
                            it(`can sign of  [${send_types.join(", ")}]  to ${recv_type}`, async () => {
                                signed = await sign_hook(GetDevice(), utxos, [to]);
                            }).timeout(30000);

                            it("check signed transaction", async () => {
                                const expected = getSignedTX(root, utxos, [to]);

                                assert.equal(signed, expected);
                            });
                        }
                    }
                });

                describe("send with return", () => {
                    for (const send_types of combination) {
                        for (const recv_type of types) {
                            for (const change_type of types) {
                                const utxos = getUTXOs(send_types, 2);
                                const amount = utxos.reduce((total, x) => total + x.satoshis, 0) - utxos.length * 300;
                                const send = Math.ceil(Math.random() * amount);
                                const to = {
                                    path: `m/${getPurpose(recv_type)}'/0'/${RandomNumber(10)}'/${RandomNumber(2)}/${RandomNumber(20)}`,
                                    satoshis: send,
                                };
                                const change = {
                                    path: `m/${getPurpose(change_type)}'/0'/${RandomNumber(10)}'/${RandomNumber(2)}/${RandomNumber(20)}`,
                                    satoshis: amount - send,
                                };

                                let signed;
                                it(`can sign of  [${send_types.join(", ")}]  to  [${recv_type}, ${change_type}]`, async () => {
                                    signed = await sign_hook(GetDevice(), utxos, [to, change]);
                                }).timeout(30000);

                                it("check signed transaction", async () => {
                                    const expected = getSignedTX(root, utxos, [to, change]);

                                    assert.equal(signed, expected);
                                });
                            }
                        }
                    }
                });
            });
        }

        if (BROADCAST) {
            describe("broadcast with all types", () => {
                const inputs = [
                    {
                        hash: "8686aee2b9dcf559798b9718ed26ca92e0c64bef11c433e576cae658678c497d",
                        vout: 1,
                        satoshis: 1083,
                        path: "m/84'/0'/0'/1/0"
                    },
                    {
                        hash: "c6952dfbf055d100f69eb5b41514a346c9da13b6defe8856b486fb007a6b5401",
                        vout: 0,
                        txHex: "02000000000101acf46606ff0a6cf8fe890e58023ff751114067ceef3159ff4f552e03a82172770000000017160014cc54043bfa8d1d6b518a6e4fc3e474dadc23713effffffff0222020000000000001976a9145c592f40134c6179a1ce5b06b28d5c2ae443113188ac1d2d00000000000017a9147b70abf259a0222f041d826a0a826b574aeb39ef8702473044022001d706b853f066999828b802b91083478943c72dc050682e4e8d51f638ae6d94022017408215a444fe461700d204139d17d386237f50d219fb19162d40d51328562301210355fe93d3d4533397c60f39ffecfbb0b9ad4df1a99afdbc6bcda751b2f4f16b4800000000",
                        satoshis: 546,
                        path: "m/44'/0'/0'/0/0"
                    },
                    {
                        hash: "c6952dfbf055d100f69eb5b41514a346c9da13b6defe8856b486fb007a6b5401",
                        vout: 1,
                        satoshis: 11549,
                        path: "m/49'/0'/1'/1/0"
                    }
                ];
                const outputs = [
                    {
                        address: "bc1qs0k3ekx0z7a7yuq3lse7prw373s8cr8lhxvccd",
                        satoshis: 1920
                    },
                    {
                        path: `m/49'/0'/0'/1/0`,
                        satoshis: 8000
                    }
                ];

                let signed;
                it("can sign transaction", async () => {
                    signed = await sign_hook(GetDevice(), inputs, outputs);

                    assert.exists(signed);
                    assert.equal(signed.raw_tx, "020000000001037d498c6758e6ca76e533c411ef4bc6e092ca26ed18978b7959f5dcb9e2ae86860100000000ffffffff01546b7a00fb86b45688fedeb613dac946a31415b4b59ef600d155f0fb2d95c6000000006b483045022100cd9386ca4de4d13423cabcd5f146a545856af0560127aa497f47cab2b0ec8783022025e4924f3faf39733d48ff89a945114b041a7e84c87826f9bebeba7380463583012103d70e78115a73990a1ca8829694cc9b9804f668059bc01ec70fd7363a29c5b0caffffffff01546b7a00fb86b45688fedeb613dac946a31415b4b59ef600d155f0fb2d95c60100000017160014e63a4ece8a1971770b922f110cbdbaf6672b8984ffffffff02800700000000000016001483ed1cd8cf17bbe27011fc33e08dd1f4607c0cff401f00000000000017a9141bc2a2ec0c552417af3169eb8db36f8e5ff15ed68702483045022100edbdb72c74ba84f7d99935f757d3097783a342a8b0b70b673cc72bedfb2e38eb022059de51549b5ccb9c706273fb04d33426a83b427a49540641dd347412ba772f9e012103e2791fa0d823d1d444eef64af8f1befde254f11479b2a976992a9dda054c1c9c000247304402205cf3c7e07bb46f50a03e51ebd0d9191710e24ba55bd47fea978958dbaed84d19022049b02de6447a383e65ba926b9626c28998eff8e0d0072e8a579ec89994ce11e301210352fc2090d08764b5883e8a7e211192bab361fe49ffafaa60070b7d41409ec17e00000000");

                    const response = await fetch("https://api.blockchair.com/bitcoin/push/transaction", {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ data: signed.raw_tx })
                    });
                    console.log(await response.json());
                }).timeout(60000);
            });
        }
    });
}

async function sign(transport, inputs, outputs, option) {
    const { commands, rawTx } = SecuxBTC.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of commands) {
        const rsp = await transport.Exchange(cmd);
        rspList.push(rsp);
    }

    return SecuxBTC.resolveTransaction(rspList, {
        rawTx,
        publickeys: inputs.map(x => x.publickey),
    });
}

async function sign_hook(transport, inputs, outputs, option) {
    const data = await transport.sign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of data.multi_command) {
        const rsp = await transport.Exchange(cmd);
        rspList.push(rsp);
    }

    return SecuxBTC.resolveTransaction(rspList, data);
}

function getPurpose(type) {
    switch (type) {
        case "p2pkh": return 44;
        case "p2sh_p2wpkh": return 49;
        case "p2wpkh": return 84;
        case "p2tr": return 86;

        default: throw type;
    }
}

function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
}

function getUTXO(type, num) {
    const vector = require("./btc_vector.json");
    const array = [...vector[type]];

    shuffle(array);
    const result = array.splice(0, num) ?? [];
    if (result.length === num) return result;
    if (type === "p2pkh") return result;

    const purpose = getPurpose(type);
    const iter = num - result.length;
    for (let i = 0; i < iter; i++) {
        result.push(
            {
                hash: randomBytes(32).toString("hex"),
                vout: Math.floor(Math.random() * 10),
                satoshis: Math.floor(Math.random() * 1e12),
                path: `m/${purpose}'/0'/${RandomNumber(10)}'/${RandomNumber(2)}/${RandomNumber(20)}`
            }
        );
    }

    return result;
}

function getUTXOs(types, num) {
    const utxos = [];

    for (const type of types) {
        const utxo = getUTXO(type, num);
        utxos.push(...utxo);
    }

    shuffle(utxos);

    return utxos;
}

export function getInputData(
    input,
    root,
    network,
) {
    let tp = "p2pkh";
    let isSegwit = false;
    let redeemType = "noredeem";
    switch (input.script ?? getDefaultScript(input.path)) {
        case ScriptType.P2SH_P2WPKH:
            tp = "p2sh-p2wpkh";
            isSegwit = true;
            redeemType = "p2sh";
            break;

        case ScriptType.P2SH_P2PKH:
            tp = "p2sh-p2pkh";
            isSegwit = false;
            redeemType = "p2sh";
            break;

        case ScriptType.P2WPKH:
            tp = "p2wpkh";
            isSegwit = true;
            redeemType = "noredeem";
            break;
    }
    const payment = createPayment(tp, [root.derivePath(input.path)], network).payment;

    const mixin = {};
    if (!isSegwit) {
        mixin.nonWitnessUtxo = Buffer.from(input.txHex, "hex");
    }
    else {
        if (input.txHex) {
            mixin.witnessUtxo = getWitnessUtxo(input.txHex, input.vout);
        }
        else {
            mixin.witnessUtxo = {
                script: getOutputData(input, root, btc.networks.bitcoin).script,
                value: input.satoshis
            };
        }
    }

    const mixin2 = {};
    switch (redeemType) {
        case 'p2sh':
            mixin2.redeemScript = payment.redeem.output;
            break;
        case 'p2wsh':
            mixin2.witnessScript = payment.redeem.output;
            break;
        case 'p2sh-p2wsh':
            mixin2.witnessScript = payment.redeem.redeem.output;
            mixin2.redeemScript = payment.redeem.output;
            break;
    }
    return {
        hash: input.hash,
        index: input.vout,
        ...mixin,
        ...mixin2,
    };
}

function getWitnessUtxo(txHex, vout) {
    const decoded = decode(txHex);

    return {
        script: decoded.outs[vout].scriptBuffer,
        value: decoded.outs[vout].value
    };
}

function RandomNumber(max) {
    return Math.floor(Math.random() * max).toString();
}

export function createPayment(_type, myKeys, network) {
    const splitType = _type.split('-').reverse();
    const isMultisig = splitType[0].slice(0, 4) === 'p2ms';
    const keys = myKeys || [];
    let m;
    if (isMultisig) {
        const match = splitType[0].match(/^p2ms\((\d+) of (\d+)\)$/);
        m = parseInt(match[1], 10);
        let n = parseInt(match[2], 10);
        if (keys.length > 0 && keys.length !== n) {
            throw new Error('Need n keys for multisig');
        }
        while (!myKeys && n > 1) {
            keys.push(ECPair.makeRandom({ network }));
            n--;
        }
    }
    if (!myKeys) keys.push(ECPair.makeRandom({ network }));

    let payment;
    splitType.forEach(type => {
        if (type.slice(0, 4) === 'p2ms') {
            payment = btc.payments.p2ms({
                m,
                pubkeys: keys.map(key => key.publicKey).sort((a, b) => a.compare(b)),
                network,
            });
        } else if (['p2sh', 'p2wsh'].indexOf(type) > -1) {
            payment = (btc.payments)[type]({
                redeem: payment,
                network,
            });
        } else {
            payment = (btc.payments)[type]({
                pubkey: keys[0].publicKey,
                network,
            });
        }
    });

    return {
        payment,
        keys,
    };
}

export function getOutputData(output, root, network) {
    if (output.address) {
        return {
            script: btc.address.toOutputScript(output.address, network),
            value: output.satoshis
        }
    }

    if (output.path) {
        const child = root.derivePath(output.path);

        switch (output.script ?? getDefaultScript(output.path)) {
            case ScriptType.P2SH_P2WPKH:
                return {
                    script: createPayment("p2sh-p2wpkh", [child], network).payment.output,
                    value: output.satoshis
                }

            case ScriptType.P2SH_P2PKH:
                return {
                    script: createPayment("p2sh-p2pkh", [child], network).payment.output,
                    value: output.satoshis
                }

            case ScriptType.P2WPKH:
                return {
                    script: createPayment("p2wpkh", [child], network).payment.output,
                    value: output.satoshis
                }

            case ScriptType.P2TR:
                return {
                    script: createKeySpendOutput(child.publicKey),
                    value: output.satoshis
                }

            default:
                return {
                    script: createPayment("p2pkh", [child], network).payment.output,
                    value: output.satoshis
                }
        }
    }

    return {
        script: output.script,
        value: output.satoshis
    }
}

// Function for creating a tweaked p2tr key-spend only address
// (This is recommended by BIP341)
function createKeySpendOutput(publicKey) {
    while (!ecc);

    // x-only pubkey (remove 1 byte y parity)
    const myXOnlyPubkey = publicKey.slice(1, 33);
    const commitHash = btc.crypto.taggedHash('TapTweak', myXOnlyPubkey);
    const tweakResult = ecc.xOnlyPointAddTweak(myXOnlyPubkey, commitHash);
    if (tweakResult === null) throw new Error('Invalid Tweak');
    const { xOnlyPubkey: tweaked } = tweakResult;
    // scriptPubkey
    return Buffer.concat([
        // witness v1, PUSH_DATA 32 bytes
        Buffer.from([0x51, 0x20]),
        // x-only tweaked pubkey
        tweaked,
    ]);
}

// Function for signing for a tweaked p2tr key-spend only address
// (Required for the above address)
function signTweaked(messageHash, key) {
    while (!ecc);

    // Order of the curve (N) - 1
    const N_LESS_1 = Buffer.from(
        'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
        'hex'
    );
    // 1 represented as 32 bytes BE
    const ONE = Buffer.from(
        '0000000000000000000000000000000000000000000000000000000000000001',
        'hex'
    );

    const privateKey =
        key.publicKey[0] === 2
            ? key.privateKey
            : ecc.privateAdd(ecc.privateSub(N_LESS_1, key.privateKey), ONE);
    const tweakHash = btc.crypto.taggedHash(
        'TapTweak',
        key.publicKey.slice(1, 33)
    );
    const newPrivateKey = ecc.privateAdd(privateKey, tweakHash);
    if (newPrivateKey === null) throw new Error('Invalid Tweak');
    return ecc.signSchnorr(messageHash, newPrivateKey, Buffer.alloc(32));
}

function getSigHash(tx, inputs, index, scriptPubkeys) {
    const path = inputs[index].path;

    if (path.startsWith("m/44'/")) {
        return tx.hashForSignature(
            index,
            scriptPubkeys[index],
            btc.Transaction.SIGHASH_ALL
        );
    }

    if (path.startsWith("m/86'/")) {
        return tx.hashForWitnessV1(
            index,
            scriptPubkeys,
            inputs.map(x => x.satoshis),
            btc.Transaction.SIGHASH_DEFAULT
        );
    }

    return tx.hashForWitnessV0(
        index,
        scriptPubkeys[index],
        inputs[index].satoshis,
        btc.Transaction.SIGHASH_ALL
    );
}

function getSignedTX(root, inputs, outputs, isRBF) {
    const hasTaproot = inputs.find(x => x.path.startsWith("m/86'/"));

    if (hasTaproot) {
        const tx = new btc.Transaction();
        tx.version = 2;
        for (const input of inputs) {
            tx.addInput(Buffer.from(input.hash, "hex").reverse(), input.vout, isRBF ? 0xfffffffd : undefined);
        }
        for (const output of outputs) {
            const tmp = getOutputData(output, root, btc.networks.bitcoin);
            tx.addOutput(tmp.script, tmp.value);
        }

        const scriptPubkeys = inputs.map(x => getOutputData(x, root, btc.networks.bitcoin).script);
        for (let i = 0; i < inputs.length; i++) {
            const sighash = getSigHash(tx, inputs, i, scriptPubkeys);

            const prv = root.derivePath(inputs[i].path).privateKey;
            const ecpair = ECPair.fromPrivateKey(prv);
            const signature = signTweaked(sighash, ecpair);

            tx.ins[i].witness = [Buffer.from(signature)];
        }

        return tx.toHex();
    }


    const psbt = new btc.Psbt({ network: btc.networks.bitcoin });
    for (const input of inputs) {
        const tmp = getInputData(input, root, btc.networks.bitcoin);
        if (isRBF) tmp.sequence = 0xfffffffd;
        psbt.addInput(tmp);
    }
    psbt.addOutputs(outputs.map(x => getOutputData(x, root, btc.networks.bitcoin)));

    inputs.map((input, i) => {
        const prv = root.derivePath(input.path).privateKey;
        psbt.signInput(i, ECPair.fromPrivateKey(prv));
    });

    const expected = psbt
        .finalizeAllInputs()
        .extractTransaction(true)
        .toHex();

    return expected;
}

let ecc = undefined;
(async () => {
    ecc = await require("tiny-secp256k1");
    btc.initEccLib(ecc);
})();


function getCombinations(valuesArray) {
    const combi = [];
    let temp = [];
    const slent = Math.pow(2, valuesArray.length);

    for (var i = 0; i < slent; i++) {
        temp = [];
        for (var j = 0; j < valuesArray.length; j++) {
            if ((i & Math.pow(2, j))) {
                temp.push(valuesArray[j]);
            }
        }
        if (temp.length > 0) {
            combi.push(temp);
        }
    }

    combi.sort((a, b) => a.length - b.length);

    return combi;
}
