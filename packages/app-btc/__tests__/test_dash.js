const { CoinType, SecuxBTC, ScriptType } = require("@secux/app-btc");
const { SecuxDASH } = require("@secux/app-dash");
const { coinmap } = require("@secux/app-btc/src/interface");
const { getInputData, getOutputData } = require("./test_btc");
const { txCheck } = require("./decoder");
const { payments, Psbt } = require("bitcoinjs-lib");
const { validate } = require("multicoin-address-validator");
const { ECPair } = require("ecpair");
const { assert } = require("chai");


const network = coinmap[CoinType.DASH];


export function test_address(GetDevice, root) {
    describe("DASH address", () => {
        describe("native segwit address", () => {
            const path = `m/84'/5'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = payments.p2wpkh({ pubkey: child.publicKey, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDASH.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDASH.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DASH");

                //assert.equal(valid, true);
                assert.equal(address.startsWith("dash1"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DASH);

                assert.equal(type, ScriptType.P2WPKH);
            });
        });

        describe("segwit address", () => {
            const path = `m/49'/5'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const p2wpkh = payments.p2wpkh({ pubkey: child.publicKey, network });
            const expected = payments.p2sh({ redeem: p2wpkh, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDASH.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDASH.resolveAddress(rsp, path);

                assert.equal(address, expected);
            }).timeout(10000);

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DASH");

                assert.equal(valid, true);
                assert.equal(address.startsWith("7"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DASH);

                assert.equal(type, ScriptType.P2SH);
            });
        });

        describe("legacy address", () => {
            const path = `m/44'/5'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = payments.p2pkh({ pubkey: child.publicKey, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDASH.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDASH.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DASH");

                assert.equal(valid, true);
                assert.equal(address.startsWith("X"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DASH);

                assert.equal(type, ScriptType.P2PKH);
            });
        });
    });
}

export function test_tx(GetDevice, root) {
    describe("DASH transaction", () => {
        describe("p2pkh", () => {
            const inputs = [
                {
                    hash: "d1471f2c9ab2b7d1814c80f18f270efa779a489d696ee8db2ee13360111e486d",
                    vout: 0,
                    txHex: "01000000014dbd59d6ed38562107fbeb0220e31edb8c1ba8b73a34b2f824f512a24b3cbf91010000006b483045022100fa1bd6657fe88fb2b830c40b2841f7a6bfa3f154ad5913ff4aea1e2d3e139a0802207f43cb96d1cd5aa0744cb5092b01ab807fa800a798443f10ed590610925ca7160121025abaf3afa351406dc55d646c40da53c0f2fe9736ebcf6fca232a122c21b6c897ffffffff02a0860100000000001976a914c9340fea78f10172d839a2c6f4fa38dda161ef5588ac7a499300000000001976a914784ab02b6007b8847900a3543f53b597482d52a288ac00000000",
                    satoshis: 100000,
                    path: "m/44'/5'/0'/0/0"
                },
                {
                    hash: "cfdf9cac901d2b58d94b5794f71505ad13ef54739174a46657a11b74013b63de",
                    vout: 0,
                    txHex: "010000000106f0f36dc6ca008844b02e35f8f61eff042bc2dc95c03ed9555a652e504b4b25000000006b483045022100cf8c5e46bc32224a2bbac92e1fc45bbfe568dd4ea73176f5d78b4dac1e90e023022019efabf3c096a00c54d8073dc452defb826498bb230ca83b966ae94705ce6975012102b92ed8814ae5dc22c33ff0049aed40d8b9d98eaef09ac555e2f86fbb9fe7aa49ffffffff01b0840100000000001976a9145f2595bafb0ce9c9869963fb67b9100bd2235f9e88ac00000000",
                    satoshis: 99504,
                    path: "m/44'/5'/2'/0/0"
                }
            ];
            const outputs = [
                {
                    path: `m/44'/5'/${RandomNumber(100)}'/0/${RandomNumber(20)}`,
                    satoshis: 99999
                },
                {
                    path: `m/49'/5'/${RandomNumber(20)}'/0/${RandomNumber(20)}`,
                    satoshis: 88888
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxDASH.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxDASH.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxDASH.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxDASH.resolvePublickey(rsp);
                }

                signed = await sign(GetDevice(), inputs, outputs);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
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
    const { commands, rawTx } = SecuxDASH.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of commands) {
        rspList.push(
            await transport.Exchange(cmd)
        );
    }

    return SecuxDASH.resolveTransaction(rspList, {
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

    return SecuxDASH.resolveTransaction(rspList, data);
}