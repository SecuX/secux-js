const { CoinType, SecuxBTC, ScriptType } = require("@secux/app-btc");
const { SecuxDGB } = require("@secux/app-dgb");
const { coinmap } = require("@secux/app-btc/src/interface");
const { getInputData, getOutputData } = require("./test_btc");
const { txCheck } = require("./decoder");
const { payments, Psbt } = require("bitcoinjs-lib");
const { ECPair } = require("ecpair");
const { validate } = require("multicoin-address-validator");
const { assert } = require("chai");


const network = coinmap[CoinType.DIGIBYTE];


export function test_address(GetDevice, root) {
    describe("DGB address", () => {
        describe("native segwit address", () => {
            const path = `m/84'/20'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = payments.p2wpkh({ pubkey: child.publicKey, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDGB.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDGB.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DGB");

                assert.equal(valid, true);
                assert.equal(address.startsWith("dgb1"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DIGIBYTE);

                assert.equal(type, ScriptType.P2WPKH);
            });
        });

        describe("segwit address", () => {
            const path = `m/49'/20'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const p2wpkh = payments.p2wpkh({ pubkey: child.publicKey, network });
            const expected = payments.p2sh({ redeem: p2wpkh, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDGB.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDGB.resolveAddress(rsp, path);

                assert.equal(address, expected);
            }).timeout(10000);

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DGB");

                assert.equal(valid, true);
                assert.equal(address.startsWith("S"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DIGIBYTE);

                assert.equal(type, ScriptType.P2SH);
            });
        });

        describe("legacy address", () => {
            const path = `m/44'/20'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = payments.p2pkh({ pubkey: child.publicKey, network }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxDGB.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxDGB.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "DGB");

                assert.equal(valid, true);
                assert.equal(address.startsWith("D"), true);
            });

            it("can check address type", () => {
                const type = SecuxBTC.getScriptType(address, CoinType.DIGIBYTE);

                assert.equal(type, ScriptType.P2PKH);
            });
        });
    });
}

export function test_tx(GetDevice, root) {
    describe("DGB transaction", () => {
        describe("p2pkh", () => {
            const inputs = [
                {
                    hash: "4632c6b99925ebae5b806f5956d2d730415fe0c8c7edbfa2edea22e99a8f9f56",
                    vout: 0,
                    txHex: "01000000000101d0bb93c8e4a532f3aa35ca3bf6b4b20b61af34a423ac2673a19aa2ee0fc12de0000000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff0200e1f505000000001976a9141980813a746a92ac257b371404ba9dade95f335588ac2c3e62020000000017a9144f4477a2d6730e817bb711b6e297e1b54f953c768702483045022100d0828f20106ac5050347adf96a873d14a7d034dc03abce90b09de2c02e50f91602202883ab76de94d37f2700e8d34e9c073edd0864ebe1714b6e9d3ba9bff1720f61012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d800000000",
                    satoshis: 100000000,
                    path: "m/44'/20'/0'/0/0"
                },
                {
                    hash: "e2e2606edf14601ab748e04019e47b7a74b57409c73b5d8d65a1ad2765a81fa0",
                    vout: 0,
                    txHex: "01000000000108e4b5a68513c9354a836aceb2e77619e37eb91d52b2c052a440772cf2f51b0b3d000000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff7640e074b73d7d6b4145af5a1f4bd1b9dcd09bf29f00ccdfa1d5fa32c4fbd61f000000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff06a317961210c40b4a588157bd601d2aa6ff7c25c4f0a03c7553ca8eeacc0a7b000000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff952289210419724fa046b866289fbce3b78e99aa10963fa3475ccf75d4afc67b010000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff952289210419724fa046b866289fbce3b78e99aa10963fa3475ccf75d4afc67b000000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff58cc01ee1a298915133e42854e255815690a600c271b169014fe2e7cbe703dd9010000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff7a630116a9437642bd7b20fbb1ee7d60b833f8adfe0991d4d0d1ec8204d7302b000000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff24e1ad54443f6fb2cfbb984a011d3f85c686d75130ac32ef6e5373936eedf009000000001716001446c97e59d75ba49264aee1856e44acb9f2e07b14ffffffff02a0860100000000001976a9141980813a746a92ac257b371404ba9dade95f335588ac1a31e70b0000000017a9144f4477a2d6730e817bb711b6e297e1b54f953c768702483045022100f253ebd0a31e715f8e0063499205d51fe47eecef2c13b396c5def93f85768917022016acef6ee58dcca76f7942a76ccc733bde3a7e1c843295d63a9dbf887dbc2902012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d8024730440220305d2ff890d34b1a15a4325a29dbc9abf6cfdb3e49c9c84a74f546a3aad93a60022068a9fe475a05f9193c1b38b8a1472e6026c6449922878bb766b284d00ad4f32c012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d802483045022100b34d28670c5dc3713331faf4d0c6ef48c6b03733d9ada459b004b921aec628c902203ee9ff3f06fce6e28500e7e6ecd416d0a8e77a13bf2dd8802c9ce05d63b3095d012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d802483045022100ada850866c62ee270ed7ec044033b8b26ffa6d796cabf32f6048c73ddabae79b022017d82a501108ea87fe81b66f4b781e3e65778ad88975a9f62ecc1fe6477bc016012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d802483045022100c01f797fbc3b08e2abef355c085736ecb29b004407f6e962ed725531d50b103e0220352d9789d63c841659491109dbf1347f905992e78649f9d9c01e7e071e69880d012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d80247304402205b3318a2e585bac468ee5f4ec7921212ccc9bc9f27a9839b334987ae27165b7a022028bd541baae82873c0a50cd327188ec00d79344d268a851bc919cf19ecfacc43012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d802473044022021c4a370fd1c9d8f0cc6414910fd9b01f070028d526b2883bc5b3e2270c40afb022060104a72d1a79d1bf205a9325d520176d8bdae35aa001b6a7a6a8cc89b9f4e76012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d8024830450221008e8c1f9f6b249db8ed16681ac3ce866ffb05b169b952be338c17f5495116f127022069636ffb51e55d4a696c9b45da81096edc4531f3f843bb5f26d8254f5d3c57fe012102e8a9b316e83b33f9d6526df31ee7acf8a562ad72f9e43014a4209295477ae9d800000000",
                    satoshis: 100000,
                    path: "m/44'/20'/0'/0/0"
                }
            ];
            const outputs = [
                {
                    path: `m/44'/20'/${RandomNumber(100)}'/0/${RandomNumber(20)}`,
                    satoshis: 77777777
                },
                {
                    path: `m/44'/20'/${RandomNumber(20)}'/0/${RandomNumber(20)}`,
                    satoshis: 22222222
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxDGB.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxDGB.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxDGB.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxDGB.resolvePublickey(rsp);
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

        describe("p2sh(p2wpkh)", () => {
            const inputs = [
                {
                    hash: "18638cd984ab631ad7dafc5a701bec3ffa9b26bed5855eee4598d53a2ecad870",
                    vout: 0,
                    txHex: "0100000006f2284deeaea7b0562b16ac26b2586105544ffb11aad5f925d98c524df0f4663d000000006a473044022001022e160b22fa44cb82c1d84d7a0c672bf7e501412dca64ef63bd6228413f9102207f2eca5aa974cd309ebc1cf2a6186ea401e11f0431bfac6072ce2a908987779d01210383307693d0c8ce54f65f484fa0025404f66f16624aeb0a68878da87d2ea0b5b9ffffffff4506bbb6a15f2289a7f4d9b6c001a8cd17d9dffda1429a5b66bc314c2cebda54000000006b483045022100bb34d524571ecf92a4114be8b93bc989cc039f8005e2869920382c2482ceb9a602206adf174b021f27be5262d6b1ed79292aae9151f1f1831432d0e6ef1f211b401301210383307693d0c8ce54f65f484fa0025404f66f16624aeb0a68878da87d2ea0b5b9ffffffffbe4391689de831dcbfa463402b4b9d2d7d40e06f37dcc1d4f42e51f59a7677d4000000006b483045022100ef5b6f253fffcc0e1363a4ff79bf7dbb8a945cbc046b25dfcff140e29b7bac870220083ffa6d5d2881f528252cf6ea4762a22ad00c3511037a98e640400103f31e5e01210383307693d0c8ce54f65f484fa0025404f66f16624aeb0a68878da87d2ea0b5b9ffffffff057d679699ecb665a92122f7b38167c9705a6b56b2f25f95bcc57bdd74c90f4c000000006a473044022019c8157eaaa05af79c241de5ab00788e68aaa7fab002674cd4e7d81719e74ab602204bcc9204d595da1544d79c89d89154cac06863942d3a71828e448a083da97b1c01210383307693d0c8ce54f65f484fa0025404f66f16624aeb0a68878da87d2ea0b5b9ffffffff04e260ba1d02e96c4a00ab346a70dac863d7c5f71fc5812009ac295fe36ed899000000006b4830450221008077ed3ba755f886b55fa91be329b867e5fada0970773f06eb099fae51b8da870220407ef10221d2168208f05efcd77b55eda5b0448180fd3cf070237c67a36b78b401210383307693d0c8ce54f65f484fa0025404f66f16624aeb0a68878da87d2ea0b5b9ffffffff97e55d3e5e222d8bd2bb9e049db9285e4f0a1ccf5c856b3c7ff762511c59d767000000006b483045022100a3a1990f67204e790024a20e6f972589acf11cd4d207924a3086bc60a8efcb2602207e314923d45ea20c2ce9070c5e0843e565b7dc9366f2c3a2a8d1684a0db8347701210383307693d0c8ce54f65f484fa0025404f66f16624aeb0a68878da87d2ea0b5b9ffffffff0280f0fa020000000017a9144f4477a2d6730e817bb711b6e297e1b54f953c76870c8f9800000000001976a9141980813a746a92ac257b371404ba9dade95f335588ac00000000",
                    satoshis: 50000000,
                    path: "m/49'/20'/0'/0/0"
                },
                {
                    hash: "b57e41600ff702a24857a08f78fbf8ebc41823c1d890df6aef78733f8ab849c6",
                    vout: 0,
                    txHex: "01000000017a630116a9437642bd7b20fbb1ee7d60b833f8adfe0991d4d0d1ec8204d7302b010000006b483045022100acf67549d6063f0b7b1d31bc394df22d9318b190440778fb9eaeef726f3d4d2c0220745b525b65a5953c7c8e6fc51da0f18284e1c39202ea902352c61e1c88160a5e01210383307693d0c8ce54f65f484fa0025404f66f16624aeb0a68878da87d2ea0b5b9ffffffff01b617e60b0000000017a9144f4477a2d6730e817bb711b6e297e1b54f953c768700000000",
                    satoshis: 199628726,
                    path: "m/49'/20'/0'/0/0"
                }
            ];
            const outputs = [
                {
                    address: "D7TwNix9ziu8k16gAcqkyKWvXhXg7tkdAC",
                    satoshis: 240000000
                },
                {
                    path: `m/49'/20'/0'/0/${RandomNumber(20)}`,
                    satoshis: 7000,
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxDGB.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxDGB.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxDGB.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxDGB.resolvePublickey(rsp);
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
    const { commands, rawTx } = SecuxDGB.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] }, option);
    const rspList = [];
    for (const cmd of commands) {
        rspList.push(
            await transport.Exchange(cmd)
        );
    }

    return SecuxDGB.resolveTransaction(rspList, {
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

    return SecuxDGB.resolveTransaction(rspList, data);
}