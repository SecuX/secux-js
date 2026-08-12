import { EllipticCurve } from "@secux/protocol-transaction/lib/interface";

const { SecuxSUI } = require("@secux/app-sui");
const { assert } = require("chai");
const { mnemonicToSeedSync } = require("bip39");
const { derivePath, getPublicKey } = require("ed25519-hd-key");
const { Ed25519PublicKey, Ed25519Keypair } = require("@mysten/sui/keypairs/ed25519");
const { Secp256k1PublicKey, Secp256k1Keypair } = require("@mysten/sui/keypairs/secp256k1");
const { Transaction } = require("@mysten/sui/transactions");
const { verifyTransactionSignature } = require("@mysten/sui/verify");
const firmwareContentV2 = require("./firmware-content-v2/manifest.json");
const secp256k1 = require("secp256k1");


const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const seed = mnemonicToSeedSync(mnemonic);
const timeout = 60000;
export function test(GetDevice) {
  describe.skip('SecuxSUI.getAddress()', () => {
    describe("ED25519", () => {
      const path = `m/44'/784'/0'/0'/0'`;
      const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
      const expected = keypair.getPublicKey().toSuiAddress();

      it('query a SUI publickey', async () => {
        const data = SecuxSUI.preparePublickey(path);
        const rsp = await GetDevice().Exchange(data);
        const publickey = SecuxSUI.resolvePublickey(rsp);

        assert.equal(publickey, "0590f56b2f3f3bfff5b73b77e29f7b110e9619b4c2d91f188c4ffb75708deb15");
      });

      let address;
      it('query a SUI address', async () => {
        const data = SecuxSUI.prepareAddress(path);
        const rsp = await GetDevice().Exchange(data);
        address = SecuxSUI.resolveAddress(rsp);

        console.log('address', address)

        assert.equal(address, expected);
      });

      // not support
      it("can directly call", async () => {
        const addr = await GetDevice().getAddress(path);
        assert.equal(addr, address);
      });
    });

    describe("SECP256K1", () => {
      const path = `m/54'/784'/0'/0/0`;

      it('query a SUI publickey', async () => {
        const data = SecuxSUI.preparePublickey(path, EllipticCurve.SECP256K1);
        const rsp = await GetDevice().Exchange(data);
        const publickey = SecuxSUI.resolvePublickey(rsp, EllipticCurve.SECP256K1);

        console.log('pub', publickey);

        assert.equal(publickey, "02c0bf216278fe0ba485e5a8807b77a54a64a231304f674019df1f8b2ffcaaa2c7");
      });

      let address;
      it('query a SUI address', async () => {
        const keypair = Secp256k1Keypair.deriveKeypair(mnemonic);
        const expected = keypair.getPublicKey().toSuiAddress();

        console.log('expected', expected);

        const data = SecuxSUI.prepareAddress(path, EllipticCurve.SECP256K1);
        const rsp = await GetDevice().Exchange(data);
        address = SecuxSUI.resolveAddress(rsp, EllipticCurve.SECP256K1);

        assert.equal(address, expected);
      });

      it("can directly call", async () => {
        const addr = await GetDevice().getAddress(path);
        assert.equal(addr, address);
      });
    });
  });

  describe('SecuxSUI.sign()', () => {
    describe.only("firmware content v2 (hardware/virtual device)", () => {
      let devicePublickey;

      before(async () => {
        const rsp = await GetDevice().Exchange(
          SecuxSUI.preparePublickey(firmwareContentV2.path)
        );
        devicePublickey = SecuxSUI.resolvePublickey(rsp);
        assert.equal(
          devicePublickey,
          firmwareContentV2.publickey,
          "Device seed does not match the firmware fixture mnemonic"
        );
        assert.equal(
          SecuxSUI.addressConvert(devicePublickey),
          firmwareContentV2.sender,
          "Device address does not match the sender encoded in fixture transactions"
        );
      }).timeout(20000);

      for (const vector of firmwareContentV2.cases) {
        it(`signs ${vector.name}`, async () => {
          const { path, ...content } = vector.request;
          const prepare = SecuxSUI[vector.method];
          assert.isFunction(prepare, `Missing ${vector.method}`);

          const prepared = await prepare.call(SecuxSUI, path, content);
          assert.equal(
            Buffer.from(prepared.rawTx, "base64").toString("base64"),
            vector.rawTxBase64,
            "Generated rawTx differs from the golden vector"
          );
          assert.equal(
            Buffer.from(prepared.commandData, "base64").toString("base64"),
            vector.commandDataBase64,
            "Generated APDU differs from the golden vector"
          );

          console.log(vector.name);
          console.log('commandData', Buffer.from(prepared.commandData, 'base64').toString('hex'));

          const rsp = await GetDevice().Exchange(prepared.commandData);
          const signed = SecuxSUI.resolveTransaction(rsp, {
            rawTx: prepared.rawTx,
            publickey: devicePublickey,
            curve: EllipticCurve.ED25519,
          });

          assert.equal(signed.bytes, vector.rawTxBase64);
          assert.isString(signed.signature);
          const signer = await verifyTransactionSignature(
            Buffer.from(signed.bytes, "base64"),
            signed.signature
          );
          assert.equal(signer.toSuiAddress(), firmwareContentV2.sender);
        }).timeout(30000);
      }
    });

    describe("Native SUI transfer", () => {
      const path = `m/44'/784'/0'/0'/0'`;

      const txDetail = {
        to: "0xb249635cabe0218c96b1f91bc76db8da0dc03a0c7fe1b6919fa563b0c29f96e6",
        amount: "36d94c8b4a00",
        gasPrice: 100,
        gasBudget: 1088000,
        // gasPayment: [
        //   {
        //     objectId: "0xb636777b78dd9cd2f56064e432d6a678e28c6c4a6c35f0b8fdd167bcdcb4e5ea",
        //     version: "832856905",
        //     digest: "2DCDX5ajCcWuKxU2nzpH9dknq8KxqTCJeqh5o7jz1gE2"
        //   }
        // ]
      };

      it('query a SUI publickey', async () => {
        const data = SecuxSUI.preparePublickey(path);
        const rsp = await GetDevice().Exchange(data);
        txDetail.publickey = SecuxSUI.resolvePublickey(rsp);
      });

      let signed;
      it("can sign transaction", async () => {
        const { commandData, rawTx } = await SecuxSUI.prepareSign(path, txDetail);

        console.log('commandData', Buffer.from(commandData, 'base64').toString('hex'));

        const rsp = await GetDevice().Exchange(commandData);

        signed = SecuxSUI.resolveTransaction(rsp, {
          rawTx,
          publickey: txDetail.publickey,
          curve: 1, // ED25519
        });

        assert.exists(signed.bytes);
        assert.exists(signed.signature);
      }).timeout(20000);

      // it("can directly sign", async () => {
      //   const result = await GetDevice().sign(path, txDetail);
      //   assert.deepEqual(result, signed);
      // }).timeout(20000);
    });

    describe("Native SUI transfer with gas payment", () => {
      const path = `m/44'/784'/0'/0'/0'`;

      const txDetail = {
        to: "0xb249635cabe0218c96b1f91bc76db8da0dc03a0c7fe1b6919fa563b0c29f96e6",
        amount: "36d94c8b4a00",
        gasPrice: 100,
        gasBudget: 1088000,
        gasPayment: [
          {
            objectId: "0xb636777b78dd9cd2f56064e432d6a678e28c6c4a6c35f0b8fdd167bcdcb4e5ea",
            version: "832856905",
            digest: "2DCDX5ajCcWuKxU2nzpH9dknq8KxqTCJeqh5o7jz1gE2"
          }
        ]
      };

      it('query a SUI publickey', async () => {
        const data = SecuxSUI.preparePublickey(path);
        const rsp = await GetDevice().Exchange(data);
        txDetail.publickey = SecuxSUI.resolvePublickey(rsp);
      });

      let signed;
      it("can sign transaction", async () => {
        const { commandData, rawTx } = await SecuxSUI.prepareSign(path, txDetail);

        console.log('commandData', Buffer.from(commandData, 'base64').toString('hex'));

        const rsp = await GetDevice().Exchange(commandData);

        signed = SecuxSUI.resolveTransaction(rsp, {
          rawTx,
          publickey: txDetail.publickey,
          curve: 1, // ED25519
        });

        assert.exists(signed.bytes);
        assert.exists(signed.signature);
      }).timeout(timeout);

      // it("can directly sign", async () => {
      //   const result = await GetDevice().sign(path, txDetail);
      //   assert.deepEqual(result, signed);
      // }).timeout(20000);
    });

    describe("Token transfer", () => {
      const path = `m/44'/784'/0'/0'/0'`;

      const txDetail = {
        to: "0xcf0e82a4e6fd6246f52a7b54897364ba103b56e85e34b2a7726f0e5e25fd05d2",
        amount: 1011778,
        gasPrice: 556,
        gasBudget: 15000,
        type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
      };

      it('query a SUI publickey', async () => {
        const data = SecuxSUI.preparePublickey(path);
        const rsp = await GetDevice().Exchange(data);
        txDetail.publickey = SecuxSUI.resolvePublickey(rsp);
      });

      let signed;
      it("can sign token transfer", async () => {
        const { commandData, rawTx } = await SecuxSUI.prepareSign(path, txDetail);

        console.log('commandData', Buffer.from(commandData, 'base64').toString('hex'));

        const rsp = await GetDevice().Exchange(commandData);

        signed = SecuxSUI.resolveTransaction(rsp, {
          rawTx,
          publickey: txDetail.publickey,
          curve: 1, // ED25519
        });

        assert.exists(signed.bytes);
        assert.exists(signed.signature);
      }).timeout(20000);
    });

    describe("Token transfer with pas payment", () => {
      const path = `m/44'/784'/0'/0'/0'`;

      const txDetail = {
        to: "0xcf0e82a4e6fd6246f52a7b54897364ba103b56e85e34b2a7726f0e5e25fd05d2",
        amount: 1011778,
        gasPrice: 556,
        gasBudget: 15000,
        gasPayment: [
          {
            objectId: "0xb636777b78dd9cd2f56064e432d6a678e28c6c4a6c35f0b8fdd167bcdcb4e5ea",
            version: "839757834",
            digest: "GjADgMR1UYcvxQXv63mzt4eAvDqnoYABNoCy7kNdS57u"
          }
        ],
        type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
      };

      it('query a SUI publickey', async () => {
        const data = SecuxSUI.preparePublickey(path);
        const rsp = await GetDevice().Exchange(data);
        txDetail.publickey = SecuxSUI.resolvePublickey(rsp);
      });

      let signed;
      it("can sign token transfer", async () => {
        const { commandData, rawTx } = await SecuxSUI.prepareSign(path, txDetail);

        console.log('commandData', Buffer.from(commandData, 'base64').toString('hex'));

        const rsp = await GetDevice().Exchange(commandData);

        signed = SecuxSUI.resolveTransaction(rsp, {
          rawTx,
          publickey: txDetail.publickey,
          curve: 1, // ED25519
        });

        assert.exists(signed.bytes);
        assert.exists(signed.signature);
      }).timeout(timeout);
    });

    // describe("NFT transfer", () => {
    //   const path = `m/44'/784'/0'/0'/0'`;
    //   const { key } = derivePath(path, seed.toString("hex"));
    //   const pk = new Ed25519PublicKey(key);
    //   const publickey = Buffer.from(pk.toRawBytes()).toString("hex");

    //   const txDetail = {
    //     publickey,
    //     to: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    //     gasPrice: 1000,
    //     gasBudget: 10000,
    //     gasPayment: [
    //       {
    //         objectId: "0x1111111111111111111111111111111111111111111111111111111111111111",
    //         version: 1,
    //         digest: "digest111111111111111111111111111111111111111"
    //       }
    //     ],
    //     nfts: [
    //       {
    //         objectId: "0x3333333333333333333333333333333333333333333333333333333333333333",
    //         version: 3,
    //         digest: "digest333333333333333333333333333333333333333"
    //       }
    //     ]
    //   };

    //   let signed;
    //   it("can sign NFT transfer", async () => {
    //     const result = await GetDevice().sign(path, txDetail);
    //     signed = result;
    //     assert.exists(signed.transactionBlock);
    //     assert.exists(signed.signature);
    //   }).timeout(timeout);
    // });
  });
}


function RandomInt(max) {
  const value = Math.floor(Math.random() * max);
  return value.toString();
}
