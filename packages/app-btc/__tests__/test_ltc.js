const { CoinType, SecuxBTC, ScriptType } = require("@secux/app-btc");
const { SecuxLTC } = require("@secux/app-ltc");
const { coinmap } = require("@secux/app-btc/src/interface");
const { getInputData, getOutputData } = require("./test_btc");
const { txCheck } = require("./decoder");
const { payments, Psbt } = require("bitcoinjs-lib");
const { ECPair } = require("ecpair");
const { validate } = require("multicoin-address-validator");
const { assert } = require("chai");


const network = coinmap[CoinType.LITECOIN];


export function test_address(GetDevice, root) {
    describe("LTC address", () => {
        describe("native segwit address", () => {
            const path = `m/84'/2'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = payments.p2wpkh({ pubkey: child.publicKey, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxLTC.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxLTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "LTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("ltc1"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.LITECOIN);

                assert.equal(type, ScriptType.P2WPKH);
            });
        });

        describe("segwit address", () => {
            const path = `m/49'/2'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const p2wpkh = payments.p2wpkh({ pubkey: child.publicKey, network });
            const expected = payments.p2sh({ redeem: p2wpkh, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxLTC.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxLTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            }).timeout(10000);

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "LTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("M"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.LITECOIN);

                assert.equal(type, ScriptType.P2SH);
            });
        });

        describe("legacy address", () => {
            const path = `m/44'/2'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = payments.p2pkh({ pubkey: child.publicKey, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxLTC.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxLTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "LTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("L"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.LITECOIN);

                assert.equal(type, ScriptType.P2PKH);
            });
        });
    });
}

export function test_tx(GetDevice, root) {
    describe("LTC transaction", () => {
        describe("p2pkh", () => {
            const inputs = [
                {
                    hash: "7e874e94ae254287ec713b116b7af73067a5e15eb5c19e879d1e465ca53e7d63",
                    vout: 0,
                    txHex: "01000000000101871030aba5648209200c4893d8105f072f93f91d7c924bf4bd69b58b963e0daa0000000017160014cdef67d9de4fb8d777e06911e6300adb23da0290ffffffff0113990400000000001976a9149847dcf7841e9c2a0ee5026bb35c883d8b0490ae88ac02483045022100ee68450c3aa3b0d7fbde3459c6be50a88985c407043c3c1a118b977722f83222022026a7d3cb65a4e4b8c9e2888c01064c2841ba9a0ca8d008951a7c44524be2fc3e01210281d5cefc6f5d80529346c26bca8cceced5d1dfdf97349e490cfa2757e114529800000000",
                    satoshis: 301331,
                    path: "m/44'/2'/0'/0/0"
                },
                {
                    hash: "a1c429c78b264b6168915506aa0a36870201da1ec8a361dcc5498a79487ca66e",
                    vout: 0,
                    txHex: "0100000000010224859ff9e443754d81a7a4aee75ff74a74b88731522b97fa3327c7310dd22dda0000000017160014cdef67d9de4fb8d777e06911e6300adb23da0290ffffffffa0f5a6ee2b7810019b9f26bf2123f6e5bb3772ac111df65ae4d12b2b93cc89420000000017160014cdef67d9de4fb8d777e06911e6300adb23da0290ffffffff01d3a00400000000001976a9149847dcf7841e9c2a0ee5026bb35c883d8b0490ae88ac0248304502210083529feda2fcc0ad2168d0bcc14430881f39416028580e3c8c48efa4498340d3022031414b45842a8385133e38d44d22a0acaed377a99a6ab5c4a8b8534453e8890e01210281d5cefc6f5d80529346c26bca8cceced5d1dfdf97349e490cfa2757e114529802483045022100a2e1e1041656af03413591b76d42661124cad858d87da8ab18621f29d6eb48690220620ed59a14955294122500df4db78c2c53ee245048e273f88dd7dc2d361bcedc01210281d5cefc6f5d80529346c26bca8cceced5d1dfdf97349e490cfa2757e114529800000000",
                    satoshis: 303315,
                    path: "m/44'/2'/0'/0/0"
                }
            ];
            const outputs = [
                {
                    path: `m/44'/2'/0'/0/${RandomNumber(20)}`,
                    satoshis: 500000
                },
                {
                    path: "m/44'/2'/0'/0/0",
                    satoshis: 100000
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxLTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxLTC.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxLTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxLTC.resolvePublickey(rsp);
                }

                signed = await sign(GetDevice(), inputs, outputs);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const raw_tx = await sign_hook(GetDevice(), inputs, outputs);  

                assert.equal(raw_tx, signed);
            }).timeout(10000);

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

        describe("p2sh(p2wpkh)", () => {
            const inputs = [
                {
                    hash: "584dfb8b4a68d80f6ffd461abc46e7a5e1c6400518eddb8dc2fde1374ec09d27",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "01000000000102dcadd902400dbad2fbea86fcf7214790b1a3364cdf83682cbbe9dd9887ff85320000000017160014cdef67d9de4fb8d777e06911e6300adb23da0290ffffffffd440adf625002c3181645569d676b1ff3b2df281ee73ce44e2979aebf4585b650000000017160014cdef67d9de4fb8d777e06911e6300adb23da0290ffffffff01230403000000000017a9145622eb54ee52de8bd9d5498cb5b16bec0bbbef7e8702483045022100d8b863460b4018544224f91f751bb753a3e6666500ba0ff128505b4550fbbd9802200a3074fbdcdb37e0ce5a84b800ba4356f7aa0905726f02b6be9cbade03301b5701210281d5cefc6f5d80529346c26bca8cceced5d1dfdf97349e490cfa2757e1145298024830450221008155cbdf4c215348e790eee47220a054beddba8c4d3e3d2f42287d17502d483202202cb0a544e9a1c963ec46f2e7f835d07d39c3fabbe827567c1093e91b9a4dd64101210281d5cefc6f5d80529346c26bca8cceced5d1dfdf97349e490cfa2757e114529800000000",
                    satoshis: 197667,
                    path: "m/49'/2'/1'/0/0"
                },
                {
                    hash: "ebd04672981fa215f130ecdbac56f386e4e76326eaa808e081f67c2de79d949c",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "010000000001016086d4c4f18c1f90e445764de453cb58cfc0f918f39f9480c36107315fccfc690000000017160014d8478af105839479eef96fa88407f5802e974b76ffffffff02102700000000000017a914ea48d362d5b174eedf44e2cafe67101963981f4987433004000000000017a914baaa475d9ef56c1c1b68a18d983dc7fdaf68fe1e8702473044022036140ac5ce9be805f061b3046a99b48fc782e0972c6a91edd4b86acb3548292f022061aba9181e213b8d02861649b9f1968a32c522b8afea3d2f733cbd90fae616be012102ef5632722d92578422932f0a60b0dd137cc80c1bb8d348e15dfed7b67ddd226500000000",
                    satoshis: 10000,
                    path: "m/49'/2'/0'/0/0"
                }
            ];
            const outputs = [
                {
                    address: "MFkcBAGgM664drwch3G3L4VWByPQVABQ3Q",
                    satoshis: 200000
                },
                {
                    path: `m/49'/2'/0'/0/123`,
                    satoshis: 7000,
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxLTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxLTC.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxLTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxLTC.resolvePublickey(rsp);
                }

                signed = await sign(GetDevice(), inputs, outputs);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const raw_tx = await sign_hook(GetDevice(), inputs, outputs);

                assert.equal(raw_tx, signed);
            }).timeout(10000);

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
    const { commands, rawTx } = SecuxLTC.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of commands) {
        rspList.push(
            await transport.Exchange(cmd)
        );
    }

    return SecuxLTC.resolveTransaction(rspList, {
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

    return SecuxLTC.resolveTransaction(rspList, data);
}