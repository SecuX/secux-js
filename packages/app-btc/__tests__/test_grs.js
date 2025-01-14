const { CoinType, ScriptType, SecuxBTC } = require("@secux/app-btc");
const { getDefaultScript } = require("@secux/app-btc/lib/utils");
const { SecuxGRS } = require("@secux/app-grs");
const grs = require("groestlcoinjs-lib");
import validateGRS from "groestlcoin-address-validation";
import { coinmap } from "@secux/app-btc/lib/interface";
const { txCheck, decode } = require("./decoderGRS");
const { assert } = require("chai");


const network = coinmap[CoinType.GROESTL];

export function test_address(GetDevice, root) {
    describe("GRS address", () => {
        describe("legacy address", () => {
            const path = `m/44'/17'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = grs.payments.p2pkh({ pubkey: child.publicKey }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxGRS.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxGRS.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validateGRS(address);

                assert.notEqual(valid, false);
                assert.equal(valid.type, "p2pkh");
                assert.equal(valid.network, "mainnet");
                assert.equal(valid.bech32, false);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.GROESTL);

                assert.equal(type, ScriptType.P2PKH);
            });

            it("can derive address", () => {
                const xpub = "xpub6CiJTWRmyvJQ7j3Zsxx8a9qBZvvs7FiJNLuu59o5gionQocLVKZUX5cGUbPLnwMuTdRgyP4FXjBpvUbZt7a1ryHon2NsqaZvYatsnyrpCEe";
                const test = [
                    { address: "FZVhsDmfWoJkbf4prFPPpSn8ELvjZcJr2U", change: 0, index: 0 },
                    { address: "FaUhceDtZZGigmB6bb1o2UQ7g3saPh7pJq", change: 0, index: 1 },
                    { address: "FnGtL29ag58oCrRynEHALDQPfvnkLkiXCA", change: 0, index: 2 },
                    { address: "Ff4Rm2Uwtqxz5iaojZsmh6vmCLobaythHK", change: 0, index: 3 },
                    { address: "FmEbo6DWXcgforTMvk4ABnTRy9bQJEApL7", change: 0, index: 4 },
                    { address: "Fb8QahnZaGQHHAioJZeAeCSJ9bBonmFnaP", change: 1, index: 0 },
                    { address: "FsxeYfF3znXoeRJ7e7CxaktgzQE8omgLEz", change: 1, index: 1 },
                    { address: "FZ4ftAEMCXo6XArUmFPD1vtosS3yeNeFTs", change: 1, index: 2 },
                    { address: "FmS236xHoBwKDEJpvG3khiz1AUj51Nh255", change: 1, index: 3 },
                    { address: "FbtxaxH4gNmhS1SCtDebVGihTSMx7cJE4t", change: 1, index: 4 },
                ];

                for (const _ of test) {
                    const address = SecuxGRS.deriveAddress(xpub, _.change, _.index, {
                        coin: CoinType.GROESTL,
                        // script: ScriptType.P2PKH
                    });

                    assert.equal(address, _.address);
                }
            });
        });

        describe("segwit address", () => {
            const path = `m/49'/17'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const p2wpkh = grs.payments.p2wpkh({ pubkey: child.publicKey });
            const expected = grs.payments.p2sh({ redeem: p2wpkh }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxGRS.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxGRS.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validateGRS(address);

                assert.notEqual(valid, false);
                assert.equal(valid.type, "p2sh");
                assert.equal(valid.network, "mainnet");
                assert.equal(valid.bech32, false);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.GROESTL);

                assert.equal(type, ScriptType.P2SH);
            });

            it("can derive address", () => {
                const ypub = "ypub6YDn6ra31rUh3TwFuytgMdDrXNk6DgUQUYaVGK2D18WZtjtHtZeDoBwfnQheazRSbUDdSZvpRWxaNqu28RaVysQqRfgw8NG5XaJ2x2d1ZKd";
                const test = [
                    { address: "3Ba67HXEZQkZLKSwPvQYLzg8yT6HFMwyKE", change: 0, index: 0 },
                    { address: "3Ep2quF7jRcfiV6Xhb3EcvMP5WsrmjjL6Z", change: 0, index: 1 },
                    { address: "3FFqdykvokV9FeyG8NBCxCLt68tALvRifj", change: 0, index: 2 },
                    { address: "3KkmT9fNjJUnydFMX83BU6uLoxx33ujqjN", change: 0, index: 3 },
                    { address: "39eEs9THdLgUjyZaj2MdFHCXAfSd7cUMk7", change: 0, index: 4 },
                    { address: "34evmmxrbxNDVcEozZLVWcisyiz3FLi5Ri", change: 1, index: 0 },
                    { address: "34hdyoXswQtmweXodUEFVR7rfKUCqTH57k", change: 1, index: 1 },
                    { address: "3KgnTLQxLwjm13RvkDQhcHwVi4vQ2ZfCC8", change: 1, index: 2 },
                    { address: "3GQQ2wTte76YMpGnHNEw5oYbNv2kxDV3Ct", change: 1, index: 3 },
                    { address: "38qcwqMt2DDmanPDHFFrgqyXdrE5Fh2h68", change: 1, index: 4 },
                ];

                for (const _ of test) {
                    const address = SecuxGRS.deriveAddress(ypub, _.change, _.index, {
                        coin: CoinType.GROESTL,
                        // script: ScriptType.P2SH_P2WPKH
                    });

                    assert.equal(address, _.address);
                }
            });
        });

        describe("native segwit address", () => {
            const path = `m/84'/17'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = grs.payments.p2wpkh({ pubkey: child.publicKey }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxGRS.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxGRS.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validateGRS(address);

                assert.notEqual(valid, false);
                assert.equal(valid.type, "p2wpkh");
                assert.equal(valid.network, "mainnet");
                assert.equal(valid.bech32, true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.GROESTL);

                assert.equal(type, ScriptType.P2WPKH);
            });

            it("can derive address", () => {
                const zpub = "zpub6qPmfVh9XKjDZU683cWKXDzmBcVWoAgob4UJuQ95FdcZR6hDtuy4UShzdEkVcQMohjmAUsXe1wbKTZcqLrifSczKXVQBxUUJsDJ9nwPB2Df";
                const test = [
                    { address: "grs1qtf9ksu8d8yhuel84glwwcmratzqnpmdy3mwt9f", change: 0, index: 0 },
                    { address: "grs1qv9eaqanz33dl80j8c9v8f3umxkhuqmx6rzr3w6", change: 0, index: 1 },
                    { address: "grs1qvtng8ugquaufce48s9asw4tr38ykymm92geqgu", change: 0, index: 2 },
                    { address: "grs1qka76h0xef0qyh3nxjnl7g5ehp9k2965w99tpjw", change: 0, index: 3 },
                    { address: "grs1q8wrp0lrjv4jksw0de2k8w4cetc4qfuw8pdcpen", change: 0, index: 4 },
                    { address: "grs1qmrkdhwxsk4gat3rlvmkvuxxt7x9az7c60usxam", change: 1, index: 0 },
                    { address: "grs1qxryvna6nqmu8z59qarz7lunszjrha43rm6swh8", change: 1, index: 1 },
                    { address: "grs1q6wlp6rxhpzu2av53fm7fewkwrlv37hdqql337e", change: 1, index: 2 },
                    { address: "grs1q8y22pkf77a5835catysmr3wns2jl6gdg776fvs", change: 1, index: 3 },
                    { address: "grs1qf9jvdywsqhxwcf42j5tz07nysuvs74m4crzvns", change: 1, index: 4 },
                ];

                for (const _ of test) {
                    const address = SecuxGRS.deriveAddress(zpub, _.change, _.index, {
                        coin: CoinType.GROESTL,
                        // script: ScriptType.P2WPKH
                    });

                    assert.equal(address, _.address);
                }
            });
        });
    });
}

export function test_tx(GetDevice, root) {
    describe("GRS transaction", () => {
        describe("p2pkh", () => {
            const inputs = [
                {
                    hash: "021fd09c855a2c742b4d25bcabf7b0a93d2f81e686875d29173d2527d3f93383",
                    vout: 0,
                    txHex: "01000000000102b0250046e7c8fc7a4428f890adf03f6cfbdeba36c5f31bb7b78e98b0327c45a1010000001716001470454cee54d0f3966f4769f22b89f00c7854760dffffffff0b7352b50d6b23c361dadf54651b3f77d1e3d06863ff932572ecae0af07c78610000000017160014aec71b817cafed717c93216c420b64cdf004d087ffffffff01ea29341d000000001976a9142f77ebea597a50930b099e1b1d95244a788dff7188ac0247304402207605a44c8c7ab14e201d55391841f30a556eebd6dcbb0c6a8fe6f0f3ee7fb63102200a57c212e582001f5c220cf980b61141073dc9c0c9519da331247a1fcb83e6f40121027e61de977f7ff3432336ebe518c9b3cbd6090bf7947894804b54242b47b9e77402483045022100e10ef1e61689ad3b3ba21b3a15d1eae6ad2538d47e29ab6c453efb16a28b89da0220312d67075914b0d90bb1c6e99284b107e97e05bd5c908c883f0e9e189688b1ff012103abeffd221d762b07581fd06122507257fd18bd18fa7f66c1138beb793f7a4fc000000000",
                    satoshis: 489957866,
                    path: "m/44'/17'/0'/0/0"
                },
                {
                    hash: "e90d8ff4dcdf800a05a18cd77a3772873e7e22b56e411e3806750de3fd987faa",
                    vout: 0,
                    txHex: "010000000001011e4de2dc6c4b7e57dc56ed059f5007590d62d136293a951d34a206c0b63e1d610100000017160014f14dc5f4d50bc82cbffab1a39b5d2e1f156907d3ffffffff01da08d717000000001976a9142f77ebea597a50930b099e1b1d95244a788dff7188ac02473044022029cefa36be95116deb079e0f49854bb2f794e3244ae65a16e6515a235236b772022040e718b11b0d6377589bb7f3e6d8990de12b80c603a9dedf07d63a81ce61b60c012102964f97930f1ed601377315031b1c0e490a9f7ab6e6b2f082c93117ad4163fd0000000000",
                    satoshis: 399968474,
                    path: "m/44'/17'/0'/0/0"
                }
            ];
            const outputs = [
                {
                    address: "38kpyoty76H1c6wWo7cfbPYNB88RsMV8AB",
                    satoshis: 123
                },
                {
                    path: `m/49'/17'/${RandomNumber(10)}'/0/${RandomNumber(20)}`,
                    satoshis: 866666666
                },
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxGRS.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxGRS.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxGRS.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxGRS.resolvePublickey(rsp);
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
                const payment = createPayment("p2pkh");
                const psbt = new grs.Psbt()
                    .addInputs(inputs.map(x => getInputData(x, root, network)))
                    .addOutputs(outputs.map(x => getOutputData(x, root, network)));

                inputs.map((input, i) => {
                    const prv = root.derivePath(input.path).privateKey;
                    psbt.signInput(i, grs.ECPair.fromPrivateKey(prv));
                });

                const expected = psbt
                    .finalizeAllInputs()
                    .extractTransaction(true)
                    .toHex();

                txCheck(signed, expected, inputs, outputs);
            });
        });

        describe("p2sh(p2wpkh)", () => {
            const inputs = [
                {
                    hash: "378b0fcdb5fd9b3ac93a54318ab0c5a514de7e8ab757358610c7bbda0352c544",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "0100000000010104602c4deda7a150a393cbd40eb733b01808e7e359654d259628cb72ac325b5d0100000017160014a4601cd59bc84ed9eb6ee5e3313f795f7c043002ffffffff0240420f000000000017a9146c61d6f91eb75ac502e853ce6610f289e1ba385f873a3e5d000000000017a914c567054a3157d4ee8b252d4b34aa698698170bd78702483045022100fb198c4fa77f5b6750e056ea86ee2a40b38d4d47dc35aa01a3e35d3e1a0aa3f10220218a0ab495502c8441c28d637c03e872fa1454c4763a3342e78e8d7b3252b9d101210332a4d9b6e51e8d60332730b55167f5d0f1ed1ea83a6bc82a07f1d2096de9e2f500000000",
                    satoshis: 1000000,
                    path: "m/49'/17'/0'/0/0"
                },
                {
                    hash: "06d155d7436bde8a0b0998d6bbbdb767bb3022d68a18ca18014c7aec77d7409d",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "010000000001018678c1c8025dbd293205a034e1e6dfafa751c5eff0a93e2265799e2e06247b170000000017160014a8d14d5fa7cee040b46b29468a0d11cd45497084ffffffff0190eefa020000000017a914c6105da0c2ccc12684d14ac4b98b3be4ab62ba7a8702473044022001f46c813b5812ae7cb990f6a2037d46da4f5b8ca4a51360b34669bc6eca959c02207229633beaa0688fd8838af3b22e88bdf835771e49d66700068b01693a1840c5012102abab9bfe9aa0f2f672d38f0e6ff0d57c47ff57b59eae192a65b362f988984e8300000000",
                    satoshis: 49999504,
                    path: "m/49'/17'/1'/0/0"
                },
                
            ];
            const outputs = [
                {
                    script: ScriptType.P2PKH,
                    path: `m/44'/17'/${RandomNumber(10)}'/0/${RandomNumber(20)}`,
                    satoshis: 50000000
                },
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxGRS.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxGRS.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxGRS.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxGRS.resolvePublickey(rsp);
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
                const payment = createPayment("p2sh-p2wpkh").payment;
                const psbt = new grs.Psbt()
                    .addInputs(inputs.map(x => getInputData(x, root, network)))
                    .addOutputs(outputs.map(x => getOutputData(x, root, network)));

                inputs.map((input, i) => {
                    const prv = root.derivePath(input.path).privateKey;
                    psbt.signInput(i, grs.ECPair.fromPrivateKey(prv));
                });

                const expected = psbt
                    .finalizeAllInputs()
                    .extractTransaction(true)
                    .toHex();

                txCheck(signed, expected, inputs, outputs);
            });
        });
    });
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

    const mixin = isSegwit ? { witnessUtxo: getWitnessUtxo(input.txHex, input.vout) } : { nonWitnessUtxo: Buffer.from(input.txHex, "hex") };

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
            keys.push(grs.ECPair.makeRandom({ network }));
            n--;
        }
    }
    if (!myKeys) keys.push(grs.ECPair.makeRandom({ network }));

    let payment;
    splitType.forEach(type => {
        if (type.slice(0, 4) === 'p2ms') {
            payment = grs.payments.p2ms({
                m,
                pubkeys: keys.map(key => key.publicKey).sort((a, b) => a.compare(b)),
                network,
            });
        } else if (['p2sh', 'p2wsh'].indexOf(type) > -1) {
            payment = (grs.payments)[type]({
                redeem: payment,
                network,
            });
        } else {
            payment = (grs.payments)[type]({
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
            address: output.address,
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

async function sign(transport, inputs, outputs, option) {
    const { commands, rawTx } = SecuxGRS.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of commands) {
        rspList.push(
            await transport.Exchange(cmd)
        );
    }

    return SecuxGRS.resolveTransaction(rspList, {
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

    return SecuxGRS.resolveTransaction(rspList, data);
}