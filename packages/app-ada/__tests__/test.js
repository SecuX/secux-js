const { SecuxADA, AddressType, DrepType } = require("@secux/app-ada");
const { NetworkInfo } = require("@secux/app-ada/lib/interface");
const cardano = require("cardano-crypto.js");
const { assert } = require("chai");


const path = "m/1852'/1815'/0'";
const addresses = [
    "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
    "addr1q9vg8j3pgq22qycvpa8asw65wmhgr3f22jl7dgx6m5w5p3wxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6suswz6j",
    "addr1q9j5hn6jenan4jqr07ek3rlj9qdp70nn8ztu75g99s36snxxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sdrvkz3",
    "addr1q8gla635jx4q8afkv2s2cgdx7qdjk0zazg5syu3zg28tfdxxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6spyzwx6",
    "addr1qy8nnkhvnqcegh42e98kep6gl6l32mw9jlvy7vkzsfwnrykxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6s6u674l",
    "addr1qy829zsw848cn6t0hhj6y3cmy779lf6z6jmaqzx3yy6vtdwxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6ses7e3c",
    "addr1q9swqv7zmrqh5ts3m5w8w26gm6pgqq9y5463f2mss05hhqwxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6spgx2ap",
    "addr1q8wggyjjkzpm2qfja4dp7j9csupnqfx3wm8xddgl9up5pgxxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6snetyxs",
    "addr1qyny5m9p44afx3sujzmntc48fdmmqc333wgksjuak20xda7xs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6s540pn2",
    "addr1q8vzfz8evdp68vvtux02l5jarv905z2sg09llnuhpz2fjkwxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6stlkz3g",
    "addr1q80yeyyj85r8wu259clrfql2pps5e0j67lnhafjvwvcx02kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6swvxx48",
    "addr1q93gre66spu9w87mfep48nxmasdjruqguxcux0plu2khnxkxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6skv69qh",
    "addr1qy3283lk2xnt3e6qgu0l3zzqq6s7p0ftr883yeyvz8flgy7xs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6stgumyl",
    "addr1q999kwyxry4qfqvknxvrpa7ucqkzapkd0pzvuhuhzmj5s67xs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6s9p6w26",
    "addr1qxyzawl8vgcd00mzdsdhzscyykm7q640p85eye0wk7a4cpkxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6srrg8kp",
    "addr1qy57nmexnwqhawvepzradlxursph4alf4ngx4xlkdl7u4s7xs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6s0jrq3p",
    "addr1qy6a9mwehm37rry3mkcn0sn2mdrfc34ssykkfp86kzs6hqkxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6saj7drr",
    "addr1q953nrek9cc40zjl5dxh6p9unkqc3fa5c9jrtataayx4vawxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6srcus95",
    "addr1q8jz99hndv25n0hrkyc7xptxslf5c4tawrkfndghpkah5fwxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6s46p29d",
    "addr1qxqglpvrxam5vzfzgpf26lk7uhgzcskfuccxp38d0pqhu3xxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6s8x46ce"
];
const rewardAddress = "stake1u8rg27fcn2363s249t8p4kvrs4w48k3tjp6x8ejlmhz9wdg8x0gx5";


export function test(GetDevice) {
    describe('SecuxADA.getAddress()', () => {
        describe("base address", () => {
            it("can generate address", async () => {
                for (let i = 0; i < addresses.length; i++) {
                    const buf = SecuxADA.prepareAddress(path);
                    const rsp = await GetDevice().Exchange(buf);
                    const address = SecuxADA.resolveAddress(rsp, AddressType.BASE, { addressIndex: i });

                    cardano.isValidShelleyAddress(address);
                    assert.equal(address, addresses[i]);
                }
            }).timeout(20000);

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path, AddressType.BASE, { addressIndex: 0 });

                assert.equal(addr, addresses[0]);
            });
        });

        describe("reward address", () => {
            it("can generate address", async () => {
                const buf = SecuxADA.prepareAddress(path);
                const rsp = await GetDevice().Exchange(buf);
                const address = SecuxADA.resolveAddress(rsp, AddressType.REWARD);

                cardano.isValidShelleyAddress(address);
                assert.equal(address, rewardAddress);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path, AddressType.REWARD);

                assert.equal(addr, rewardAddress);
            });
        });
    });

    describe("SecuxADA.sign()", () => {
        describe("transfer asset", () => {
            const inputs = [
                {
                    path: "m/1852'/1815'/0'",
                    txId: "75c7d745c5212a11a0bfc2719c35bcc2f57fda88d7afb2eb3c5f2b02c3e99ccb",
                    index: 1,
                    amount: 12663894,
                    xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
                },
                {
                    path: "m/1852'/1815'/0'",
                    txId: "6552b8f8b8b282542b07d6187fe80daa5b7a60461c97231f45c06fd97f8a3385",
                    index: 1,
                    amount: 2330624,
                    xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
                },
                {
                    path: "m/1852'/1815'/0'",
                    txId: "f997d89d7d65aa98b19d92e62a0112a621a1e7c8fe6c293cc30092ec5c4de3b4",
                    index: 1,
                    amount: 58829501,
                    xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
                },
                // {
                //     path: "m/1852'/1815'/1'/0/0",
                //     txId: "327db14940d48b7ea962f2f20c38a8822d11c7ca32868eaf1b3497f9a89c5845",
                //     index: 0,
                //     amount: 1e6,
                //     xpublickey: "c722de5ef3d4bd777516e2af3b9b1c7b048e6deaf696cffeec030405cdd5caa3fe97dce6b85a79c55c54d211b3b47d4646abd1fb13ec9150feb0374e50b0b915"
                // }
            ];
            const output = {
                address: "DdzFFzCqrhsjZHKn8Y9Txr4B9PaEtYcYp8TGa4gQTfJfjvuNLqvB8hPG35WRgK4FjcSYhgK7b2H24jLMeqmPoS3YhJq6bjStsx4BZVnn",
                // address: "addr1qyny5m9p44afx3sujzmntc48fdmmqc333wgksjuak20xda7xs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6s540pn2",
                amount: 14000000
            };

            let raw_tx;
            it("can sign transaction", async () => {
                const { commandData, serialized } = SecuxADA.prepareSign(inputs, output, {
                    changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
                });
                const rsp = await GetDevice().Exchange(commandData);
                raw_tx = SecuxADA.resolveTransaction(rsp, serialized);
            }).timeout(20000);

            it("can directly sign", async () => {
                const signed = await GetDevice().sign(inputs, output, {
                    changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
                });

                assert.equal(signed.raw_tx, raw_tx);
            }).timeout(20000);
        });

        describe("staking", () => {
            const input = {
                path: "m/1852'/1815'/0'",
                utxo: [
                    {
                        txId: "649d17d0b13b92987dbcc2b7aaf0e4121e6e8482496e83cf56605757d1156704",
                        index: 0,
                        amount: 14643392,
                    }
                ],
                changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
                xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
            }


            let raw_tx;
            it("can stake", async () => {
                const { commandData, serialized } = SecuxADA.prepareStake(
                    input,
                    "ea595c6f726db925b6832af51795fd8a46e700874c735d204f7c5841",
                    {
                        needRegistration: true
                    }
                );
                const rsp = await GetDevice().Exchange(commandData);
                raw_tx = SecuxADA.resolveTransaction(rsp, serialized);
            }).timeout(20000);

            it("can directly sign", async () => {
                const signed = await GetDevice().sign(
                    input,
                    "ea595c6f726db925b6832af51795fd8a46e700874c735d204f7c5841",
                    {
                        needRegistration: true
                    }
                );

                assert.equal(signed.raw_tx, raw_tx);
            }).timeout(20000);
        });

        describe("unstake", () => {
            const input = {
                path: "m/1852'/1815'/0'",
                utxo: [
                    {
                        txId: "bdd79c61b30480e692c983a5609e98e3ceb393f11e501b3327e3446db4d0da9c",
                        index: 0,
                        amount: 12469355,
                    }
                ],
                changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
                xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
            }


            let raw_tx;
            it("can do deregistration", async () => {
                const { commandData, serialized } = SecuxADA.prepareUnstake(input, {
                    withdrawAmount: 139785
                });
                const rsp = await GetDevice().Exchange(commandData);
                raw_tx = SecuxADA.resolveTransaction(rsp, serialized);
            }).timeout(20000);

            it("can directly sign", async () => {
                const signed = await GetDevice().sign(input, {
                    withdrawAmount: 139785
                });

                assert.equal(signed.raw_tx, raw_tx);
            }).timeout(20000);
        });

        describe("withdraw", () => {
            const input = {
                path: "m/1852'/1815'/0'",
                utxo: [
                    {
                        txId: "ddd0c3b8a0dc1350f554e919e59fd7249133c7894e21c84ca3be3520fd1ff07a",
                        index: 0,
                        amount: 12827459,
                    }
                ],
                changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
                xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
            }


            let raw_tx;
            it("can do withdraw", async () => {
                const { commandData, serialized } = SecuxADA.prepareWithdraw(input, "158463");
                const rsp = await GetDevice().Exchange(commandData);
                raw_tx = SecuxADA.resolveTransaction(rsp, serialized);
            }).timeout(20000);

            it("can directly sign", async () => {
                const signed = await GetDevice().sign(input, "158463");

                assert.equal(signed.raw_tx, raw_tx);
            }).timeout(20000);
        });

        describe("voteDelegation", () => {
            const input = {
                path: "m/1852'/1815'/0'",
                utxo: [
                    {
                        txId: "ddd0c3b8a0dc1350f554e919e59fd7249133c7894e21c84ca3be3520fd1ff07a",
                        index: 0,
                        amount: 12827459,
                    }
                ],
                changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
                xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
            };


            let raw_tx;
            it("can do vote delegation", async () => {
                const { commandData, serialized } = SecuxADA.prepareVoteDelegation(input, DrepType.ABSTAIN);
                const rsp = await GetDevice().Exchange(commandData);
                raw_tx = SecuxADA.resolveTransaction(rsp, serialized);
            }).timeout(20000);

            it("can directly sign", async () => {
                const signed = await GetDevice().sign(input, DrepType.ABSTAIN);

                assert.equal(signed.raw_tx, raw_tx);
            }).timeout(20000);
        });
    });

    describe.skip("broadcast", () => {
        const path = "m/1852'/1815'/0'";
        const api = "https://cardano-preview.blockfrost.io/api/v0";
        const project_id = "previewM8HajjWRhsvXQ76DMbuMOTKFrDCyqoQb";

        const getUTXO = async (address) => {
            const response = await fetch(
                `${api}/addresses/${address}/utxos`,
                {
                    method: "GET",
                    headers: {
                        project_id,
                    }
                }
            ).then(x => x.json());

            const utxo = response.map(utxo => ({
                txId: utxo.tx_hash,
                index: utxo.output_index,
                amount: utxo.amount[0].quantity,
            }));

            return utxo;
        };

        const submit = async (tx) => {
            const txid = await fetch(
                `${api}/tx/submit`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/cbor",
                        project_id,
                    },
                    body: Buffer.from(tx, "base64"),
                }
            ).then(x => x.json());
            console.log(txid);
        };

        it("transfer", async () => {
            const address = await GetDevice().getAddress(path, AddressType.BASE, { network: NetworkInfo.preview });
            const utxo = await getUTXO(address);
            const inputs = utxo.map(utxo => ({
                path,
                ...utxo,
            }));

            const receipt = "addr_test1qqlp9x89h2d7hukhrdr86d7exv9q4mngjjypqq64vdmnfda4lrrpt832a8rw0u8wyn5uk2lszhl5vd4rftl33xx3ncdshrafpj";
            const { raw_tx } = await GetDevice().sign(
                inputs,
                { address: receipt, amount: 1000000 },
                { changeAddress: address }
            );
            await submit(raw_tx);
        }).timeout(20000);

        it("stake", async () => {
            const address = await GetDevice().getAddress(path, AddressType.BASE, { network: NetworkInfo.preview });
            const utxo = await getUTXO(address);

            const { raw_tx } = await GetDevice().sign(
                {
                    path,
                    utxo,
                    changeAddress: address,
                },
                "ce31146655943b0b4920d06e6b62df31fef02d9df9059ca42585f6c9",
                {
                    needRegistration: true
                }
            );
            await submit(raw_tx);
        }).timeout(20000);

        it("vote delegation", async () => {
            const address = await GetDevice().getAddress(path, AddressType.BASE, { network: NetworkInfo.preview });
            const utxo = await getUTXO(address);

            const { raw_tx } = await GetDevice().sign(
                {
                    path,
                    utxo,
                    changeAddress: address,
                },
                DrepType.ABSTAIN,
            );
            await submit(raw_tx);
        }).timeout(20000);

        it("withdraw", async () => {
            const address = await GetDevice().getAddress(path, AddressType.BASE, { network: NetworkInfo.preview });
            const utxo = await getUTXO(address);

            const { raw_tx } = await GetDevice().sign(
                {
                    path,
                    utxo,
                    changeAddress: address,
                },
                "1000000",
                {
                    network: NetworkInfo.preview,
                }
            );
            await submit(raw_tx);
        }).timeout(20000);

        it("unstake", async () => {
            const address = await GetDevice().getAddress(path, AddressType.BASE, { network: NetworkInfo.preview });
            const utxo = await getUTXO(address);

            const { raw_tx } = await GetDevice().sign(
                {
                    path,
                    utxo,
                    changeAddress: address,
                },
                {
                    network: NetworkInfo.preview,
                    withdrawAmount: 1000000,
                }
            );
            await submit(raw_tx);
        }).timeout(20000);
    })
}
