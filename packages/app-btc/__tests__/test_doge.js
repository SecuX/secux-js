const { CoinType, SecuxBTC, ScriptType } = require("@secux/app-btc");
const { SecuxDOGE } = require("@secux/app-doge");
const { coinmap } = require("@secux/app-btc/src/interface");
const { getInputData, getOutputData } = require("./test_btc");
const { txCheck } = require("./decoder");
const { payments, Psbt } = require("bitcoinjs-lib");
const { ECPair } = require("ecpair");
const { validate } = require("multicoin-address-validator");
const { assert } = require("chai");


const network = coinmap[CoinType.DOGECOIN];


export function test_address(GetDevice, root) {
    describe("DOGE address", () => {
        describe("native segwit address", () => {
            const path = `m/84'/3'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = payments.p2wpkh({ pubkey: child.publicKey, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDOGE.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDOGE.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DOGE");

                //assert.equal(valid, true);
                assert.equal(address.startsWith("doge1"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DOGECOIN);

                assert.equal(type, ScriptType.P2WPKH);
            });
        });

        describe("segwit address", () => {
            const path = `m/49'/3'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const p2wpkh = payments.p2wpkh({ pubkey: child.publicKey, network });
            const expected = payments.p2sh({ redeem: p2wpkh, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDOGE.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDOGE.resolveAddress(rsp, path);

                assert.equal(address, expected);
            }).timeout(10000);

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DOGE");

                //assert.equal(valid, true);
                assert.equal(address.startsWith("9") || address.startsWith("A"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DOGECOIN);

                assert.equal(type, ScriptType.P2SH);
            });
        });

        describe("legacy address", () => {
            const path = `m/44'/3'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = payments.p2pkh({ pubkey: child.publicKey, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDOGE.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDOGE.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DOGE");

                assert.equal(valid, true);
                assert.equal(address.startsWith("D"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DOGECOIN);

                assert.equal(type, ScriptType.P2PKH);
            });
        });
    });
}

export function test_tx(GetDevice, root) {
    describe("DOGE transaction", () => {
        describe("p2pkh", () => {
            const inputs = [
                {
                    hash: "d518fa4c4c0ebbfec834a2bee55687656f5e8ab87ec91b0929e34bf4f9a97c2c",
                    vout: 0,
                    txHex: "010000000134acaae4d408863676b3a6bff86c0c4bc4cb42a32daad4512a90fefc38b03e22000000006b483045022100f784a79ddd2047f364cc7232719ec7bfcbc9a31037abc76733800f8c022fbdb402207488f4b9d525df55683ec84502d425cb27f315c811b082a27189a4bda8a9a43f0121030b83ac3d090e41f0225c5c661c819f55a0285a23e3de02397d0d4ba3ff730962ffffffff020065cd1d000000001976a9140d97584ea37579d2535003513acfa7964985cb0f88acd60a9955020000001976a9144bc4f40647bcb341888a9a7e0e8f486cdb83dc2e88ac00000000",
                    satoshis: 500000000,
                    path: "m/44'/3'/1'/0/3"
                },
                {
                    hash: "a1acc8dd173fb4d2b010a60883752a60e5b27f1dc3e940ad5542781715522ca5",
                    vout: 0,
                    txHex: "0100000001dd7b78b36b2c8ea4afb52a53157cc0970ae3948174227381fca8e5d23fc0e470010000006b48304502210091f427b191ee9ef2f582ae60e5eb5775bd9ed2ebcc05d9639ae77c1e5a82d1870220299b96732d893b763d372b2149aeac875b6d3dc4c1e629203c2f5fd2b65095900121034f7398bd5fe62fea4edff08bb8d670cb827abc43c73b8d0eeff3489c414c694cffffffff01003e5b7a000000001976a9145fc8eb4f663b8d245d2c9f77569a64500743f2b488ac00000000",
                    satoshis: 2052800000,
                    path: "m/44'/3'/0'/0/4"
                },
                {
                    hash: "8e4e5084caa1382d755ac11a8f9cdb7a5e2f903703ef51bf2910c3eea2696ea8",
                    vout: 0,
                    txHex: "01000000011e2b9cc3c3418cfe9f4139a1becb3f7b1f296c20ddbc1250a98fca220279889d000000006a47304402205c2a6036a2e8326efd3fa46001ceab59d90947722ba2814cf3ea2ccee161797f02205d4187492ab0d7eda4d5921e1c420e08b8c92a611855f7975fee622bf0045b6f012103176d1f5dc81a6a688cc39a718c4205e7ac07f63b4b0cb3b865e693c57528e3a8ffffffff0200a3e111000000001976a914f5a5911785530c6b76f4fdbfd17e3df6527da84f88ac8062d4ac000000001976a9141e54bf20b1ad24e9828c867c377d32ebba45653a88ac00000000",
                    satoshis: 300000000,
                    path: "m/44'/3'/0'/0/0"
                },
            ];
            const outputs = [
                {
                    path: `m/44'/3'/${RandomNumber(100)}'/0/${RandomNumber(20)}`,
                    satoshis: 700000000
                },
                {
                    path: `m/84'/3'/${RandomNumber(20)}'/0/${RandomNumber(20)}`,
                    satoshis: 8888888
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxDOGE.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxDOGE.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxDOGE.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxDOGE.resolvePublickey(rsp);
                }

                signed = await sign(GetDevice(), inputs, outputs);

                assert.exists(signed);
            }).timeout(30000);

            it("can directly sign", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const raw_tx = await sign_hook(GetDevice(), inputs, outputs);

                assert.equal(raw_tx, signed);
            }).timeout(30000);

            it("check raw data of signed transaction", async () => {
                const psbt = new Psbt({ network });
                for (const input of inputs) {
                    const tmp = getInputData(input, root, network);
                    psbt.addInput(tmp);
                }
                psbt.addOutputs(outputs.map(x => getOutputData(x, root, network)));

                inputs.map((input, i) => {
                    const prv = root.derivePath(input.path).privateKey;
                    psbt.signInput(i, ECPair.fromPrivateKey(prv));
                });

                const expected = psbt
                    .finalizeAllInputs()
                    .extractTransaction(true)
                    .toHex();

                txCheck(signed, expected, inputs, outputs);
            }).timeout(10000);
        });
    });
}

function RandomNumber(max) {
    return Math.floor(Math.random() * max).toString();
}

async function sign(transport, inputs, outputs, option) {
    const { commands, rawTx } = SecuxDOGE.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of commands) {
        rspList.push(
            await transport.Exchange(cmd)
        );
    }

    return SecuxDOGE.resolveTransaction(rspList, {
        rawTx,
        publickeys: inputs.map(x => x.publickey),
    });
}

async function sign_hook(transport, inputs, outputs, option) {
    const data = await transport.sign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of data.multi_command) {
        rspList.push(
            await transport.Exchange(cmd)
        );
    }

    return SecuxDOGE.resolveTransaction(rspList, data);
}