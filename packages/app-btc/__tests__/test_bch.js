const { ScriptType, SecuxBTC, CoinType } = require("@secux/app-btc");
const { SecuxBCH } = require("@secux/app-bch");
const bitGoUTXO = require("@bitgo/utxo-lib");
const { pubKeyHash, scriptHash } = require("@bitgo/utxo-lib/dist/src/templates");
const cashaddress = require("cashaddress");
const { validate } = require("multicoin-address-validator");
const { txCheck } = require("./decoder");
const { assert } = require("chai");
const randomBytes = require("randombytes");


export function test_address(GetDevice, root) {
    describe("BCH address", () => {
        describe("p2pkh address", () => {
            const path = `m/44'/145'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const keyPair = bitGoUTXO.ECPair.fromPrivateKeyBuffer(child.privateKey, bitGoUTXO.networks.bitcoincash);
            const expected = bitGoUTXO.address.toBase58Check(
                bitGoUTXO.crypto.hash160(keyPair.getPublicKeyBuffer()),
                bitGoUTXO.networks.bitcoincash.pubKeyHash
            );

            let address;
            it("query address from device", async () => {
                const data = SecuxBCH.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBCH.resolveAddress(rsp, path);

                const raw = cashaddress.decode(`bitcoincash:${address}`);
                assert.equal(bitGoUTXO.address.toBase58Check(raw.hash, bitGoUTXO.networks.bitcoincash.pubKeyHash), expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BCH");

                assert.equal(valid, true);
                assert.equal(address.startsWith("q"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.BITCOINCASH);

                assert.equal(type, ScriptType.P2PKH);
            });
        });

        describe("p2sh(p2pkh) address", () => {
            const path = `m/49'/145'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const keyPair = bitGoUTXO.ECPair.fromPrivateKeyBuffer(child.privateKey, bitGoUTXO.networks.bitcoincash);
            const p2pkh = pubKeyHash.output.encode(bitGoUTXO.crypto.hash160(keyPair.getPublicKeyBuffer()));
            const expected = bitGoUTXO.address.toBase58Check(
                bitGoUTXO.crypto.hash160(p2pkh),
                bitGoUTXO.networks.bitcoincash.scriptHash
            );

            let address;
            it("query address from device", async () => {
                const data = SecuxBCH.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBCH.resolveAddress(rsp, path);

                const raw = cashaddress.decode(`bitcoincash:${address}`);
                assert.equal(bitGoUTXO.address.toBase58Check(raw.hash, bitGoUTXO.networks.bitcoincash.scriptHash), expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BCH");

                assert.equal(valid, true);
                assert.equal(address.startsWith("p"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.BITCOINCASH);

                assert.equal(type, ScriptType.P2SH);
            });
        });

        describe("p2sh(p2wpkh) address", () => {
            const path = `m/49'/145'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;

            it("should fail to query address from device", async () => {
                let success;

                try {
                    const data = SecuxBCH.prepareAddress(path, { script: ScriptType.P2SH_P2WPKH });
                    const rsp = await GetDevice().Exchange(data);
                    address = SecuxBCH.resolveAddress(rsp, path);

                    success = true;
                } catch (error) { success = false; }

                if (success) assert.fail("the test should be failed");
            });
        });

        describe("p2wpkh address", () => {
            const path = `m/84'/145'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;

            it("should fail to query address from device", async () => {
                let success;

                try {
                    const data = SecuxBCH.prepareAddress(path);
                    const rsp = await GetDevice().Exchange(data);
                    address = SecuxBCH.resolveAddress(rsp, path);

                    success = true;
                } catch (error) { success = false; }

                if (success) assert.fail("the test should be failed");
            });
        });
    });
}

export function test_tx(GetDevice, root) {
    describe("BCH transaction", () => {
        describe("p2pkh", () => {
            const inputs = [
                {
                    hash: "b4a0e0afd8bf99b8360a22a091b1601dc5bdbdda1ab2ab2d7e74f60f97a1f4ad",
                    vout: 0,
                    txHex: "01000000047aefd21c4b1bcee23c2d4fa485f06ad9e34ce779f46c8a5d4d07f27fc075fd87010000006b483045022100f7e751e707249f17b66b4b9c407b2cc897a03c5f859fad4688d20d577be8dbf9022066e4ea1ed10df2b451cb4c95a9a9103cdd1fc658f053f52eaceb36096d1eb5f0412102babf5f6350dcdb44c078ba47606ecbf23bd34b6e9e6d8e565f1cdefa18164574ffffffffb46defc8ce21fa4a97da31fafb15de77b7d174b2f4cab0b41b207ccffd0c8b6c000000006a47304402200fff5d40f5c3c7ee5d81f6944723e21a66af12540384589df32981db1d9fcf5902204ff42a0e2301570616decdf1922b3fd51c19f81b837bca8fadb78a6993c7a377412103e3e2f368eca31df413d1d0ac8c6abb1399845cea37d7f3204d5b96fc93df5692ffffffff46cb959b6de1a2c4f5f99f15cb7705dc1b329dbdb18269c250a27738f2e9d22a000000006b483045022100e74c5889a950c7f494514f905a05eda57303bc357b6dc26a387b51bfc24dcf7f022039d4d861200603089c8c9bb03b17cbc1fa2bcd357f773640d8ff4db6bc9a736a412102b561d2fab96ca8465858565d723157f2e9978992d046d74e248c067224b6bef1ffffffffe1d3ff7e5a72484421bb654c54216145435bb61420b32e7448ae0f0aa31d2daf000000006b483045022100e26261a8e8274ed4d55d5388cf6c4a3209c6c1714b3cbaddfef280794844eb8f0220084b11c8c17dc178a930828086a974249c98878a15a91fa2effa2a26b8c2052c41210265e6656f477dfe39bb831736bf2469756a0045041999b02a12d9ca72e809594affffffff01082f0100000000001976a914b78d2ccb3e89dda933c8880e0a1f616c273968c288ac00000000",
                    satoshis: 77576,
                    path: "m/44'/145'/0'/0/0"
                },
                {
                    hash: "5b6783feca093f4051b46971a225a4ad0d85e4a7025003c33eee9228f177ae1b",
                    vout: 0,
                    txHex: "0100000003e73c1856947f408099898a54ded58d35e34881a999739688baad2e8fc5c1c1c4010000006b483045022100ba22ff4d9aaee800a8769b65958d57bec0908911f8e13551887980f5958a03720220442f0d1241ba429aae8c11553400275e7d580dc2018736f2e4cde8dcb8ab562b412102cc59d7bc82dc0ad174e360b0443cd602c59e23eae6028a88608ed6b5450fcb15ffffffffadf4a1970ff6747e2dabb21adabdbdc51d60b191a0220a36b899bfd8afe0a0b4000000006a47304402207d1aa16635e07213a1746d94de1e151f55998b09526d041d43d4508894a9fd760220038cde113e742d82f6913eb2839cd0471f5770fe470f4227568590965bbfc22f4121030ae60670525f6b0a5d2ef12894b46ba3f87c63451f33e8e234f8494a0082966dffffffff7aefd21c4b1bcee23c2d4fa485f06ad9e34ce779f46c8a5d4d07f27fc075fd87000000006b48304502210096c1e51554f3036cc14a3ef1bc1d0470c30c130d710c81d80a69d2478f72f1b80220020aa171cb0d85e1318b555d4570f3eabd21787ea6561f4a822d4ca68177328b41210386e067ca093a4a0a24bdc6a77dc717182c531c2e477b70668c29b63257a486d4ffffffff017dcc0100000000001976a91499f662e0d633ad79c61a0c4274184aa4716fb54d88ac00000000",
                    satoshis: 117885,
                    path: "m/44'/145'/1'/0/0"
                }
            ];
            const outputs = [
                {
                    address: "qzvlvchq6ce667wxrgxyyaqcf2j8zma4f54yld2x6y",
                    satoshis: 11111
                },
                {
                    path: `m/44'/145'/0'/0/2`,
                    satoshis: 16666
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBCH.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBCH.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBCH.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBCH.resolvePublickey(rsp);
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
                const expectedTX = bitgoSign(root, inputs, outputs);

                txCheck(signed, expectedTX, inputs, outputs);
            }).timeout(10000);
        });

        describe("p2sh(p2pkh)", () => {
            const inputs = [
                {
                    hash: randomBytes(32).toString("hex"),
                    vout: 0,
                    satoshis: 77576,
                    path: "m/49'/145'/0'/0/0"
                },
                {
                    hash: randomBytes(32).toString("hex"),
                    vout: 1,
                    satoshis: 117885,
                    path: "m/49'/145'/1'/0/0"
                }
            ];
            const outputs = [
                {
                    address: "ppml7v5u2zmjls9tcwjme57c6v2nst8rkyqf0g85ng",
                    satoshis: 11111
                },
                {
                    path: `m/49'/145'/0'/0/2`,
                    satoshis: 16666
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBCH.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBCH.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBCH.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBCH.resolvePublickey(rsp);
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
                const expectedTX = bitgoSign(root, inputs, outputs);

                txCheck(signed, expectedTX, inputs, outputs);
            }).timeout(10000);
        });

        describe("real case 1", () => {
            const inputs = [
                {
                    hash: "dadd8728aa5b9b96676039f967910adb1515f2e3c127c5f4e45f08a5ac60ba2a",
                    vout: 0,
                    txHex: "01000000013ceaf81dc1a123e1e600c671258308e2f3d3a7e7312bfaea6dfaa2c915da1732000000006b483045022100c0aa7ac6c716e4b18f0edd7ac7cabbca753b890521581b006f7f13b4169a0d6902207c3d6c8de38ab5cae572aebc55c898d2c395e379627c0341087a768ebb062a8c412103e3e2f368eca31df413d1d0ac8c6abb1399845cea37d7f3204d5b96fc93df5692ffffffff01e9ee0100000000001976a91455893dd6fbd7b380df30f3fd6dbecc0a4970f48f88ac00000000",
                    satoshis: 126697,
                    path: "m/44'/145'/0'/0/2"
                }
            ];
            const outputs = [
                {
                    address: "qzvlvchq6ce667wxrgxyyaqcf2j8zma4f54yld2x6y",
                    satoshis: 546
                },
                {
                    path: "m/44'/145'/0'/1/1",
                    satoshis: 125703
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBCH.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBCH.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBCH.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBCH.resolvePublickey(rsp);
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
                const expectedTX = "01000000012aba60aca5085fe4f4c527c1e3f21515db0a9167f9396067969b5baa2887ddda000000006b483045022100ac012ae74e16808c84797d6a1be9abddec74901fc81089d5b1b43f0635874d0902203997b29428e5cd2a9ff82a7e24023a901fbe688fc18493f466d2dd9b230b06514121026cab4998c9716d679dc2c46c91817ce000c5be2637b87787bbd150074dce4adbffffffff0222020000000000001976a91499f662e0d633ad79c61a0c4274184aa4716fb54d88ac07eb0100000000001976a91470e2bfd8ab229523074f3ea80432a709ff1c0a8688ac00000000";

                txCheck(signed, expectedTX, inputs, outputs);
            }).timeout(10000);
        });
    });
}

function RandomNumber(max) {
    return Math.floor(Math.random() * max).toString();
}

async function sign(transport, inputs, outputs, option) {
    const { commands, rawTx } = SecuxBCH.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of commands) {
        rspList.push(
            await transport.Exchange(cmd)
        );
    }

    return SecuxBCH.resolveTransaction(rspList, {
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

    return SecuxBCH.resolveTransaction(rspList, data);
}

function bitgoSign(root, inputs, outputs) {
    const keys = inputs.map((input) => {
        const child = root.derivePath(input.path);
        const keyPair = bitGoUTXO.ECPair.fromPrivateKeyBuffer(child.privateKey, bitGoUTXO.networks.bitcoincash);

        return keyPair;
    });

    const builder = new bitGoUTXO.TransactionBuilder(bitGoUTXO.networks.bitcoincash);
    inputs.map(input => {
        builder.addInput(input.hash, input.vout)
    });
    outputs.map(output => {
        if (output.address) {
            const raw = cashaddress.decode(`bitcoincash:${output.address}`);
            if (raw.version === "scripthash") {
                const p2sh = scriptHash.output.encode(raw.hash);
                builder.addOutput(p2sh, output.satoshis);
            }
            else {
                const p2pkh = pubKeyHash.output.encode(raw.hash);
                builder.addOutput(p2pkh, output.satoshis);
            }
        }
        else if (output.path) {
            const child = root.derivePath(output.path);
            const keyPair = bitGoUTXO.ECPair.fromPrivateKeyBuffer(child.privateKey, bitGoUTXO.networks.bitcoincash);
            const p2pkh = pubKeyHash.output.encode(bitGoUTXO.crypto.hash160(keyPair.getPublicKeyBuffer()));

            if (output.path.startsWith("m/49'/")) {
                const p2sh = scriptHash.output.encode(bitGoUTXO.crypto.hash160(p2pkh));
                builder.addOutput(p2sh, output.satoshis);
            }
            else {
                builder.addOutput(p2pkh, output.satoshis);
            }
        }
        else {
            builder.addOutput(Buffer.from(output.scriptHex, "hex"), output.satoshis);
        }
    });

    keys.map((key, i) => {
        const redeemScript = pubKeyHash.output.encode(bitGoUTXO.crypto.hash160(key.getPublicKeyBuffer()));

        builder.sign(i, key, redeemScript, 0x41, inputs[i].satoshis);
    });

    return builder.build().toHex();
}