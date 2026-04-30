import { EllipticCurve } from "@secux/protocol-transaction/lib/interface";

const { SecuxSUI } = require("@secux/app-sui");
const { assert } = require("chai");
const { mnemonicToSeedSync } = require("bip39");
const { derivePath, getPublicKey } = require("ed25519-hd-key");
const { Ed25519PublicKey, Ed25519Keypair } = require("@mysten/sui/keypairs/ed25519");
const { Secp256k1PublicKey, Secp256k1Keypair } = require("@mysten/sui/keypairs/secp256k1");
const { Transaction } = require("@mysten/sui/transactions");
const secp256k1 = require("secp256k1");


const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const seed = mnemonicToSeedSync(mnemonic);

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
    describe("Native SUI transfer", () => {
      const path = `m/44'/784'/0'/0'/0'`;

      const txDetail = {
        to: "0xcf0e82a4e6fd6246f52a7b54897364ba103b56e85e34b2a7726f0e5e25fd05d2",
        amount: 34535999,
        gasPrice: 556,
        gasBudget: 15000,
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
        const rsp = await GetDevice().Exchange(commandData);

        signed = SecuxSUI.resolveTransaction(rsp, {
          rawTx,
          publickey: txDetail.publickey,
          curve: 1, // ED25519
        });

        console.log('signature', Buffer.from(signed.signature, 'base64').toString('hex'));
        console.log('bytes', Buffer.from(signed.bytes, 'base64').toString('hex'));

        assert.exists(signed.bytes);
        assert.exists(signed.signature);
      }).timeout(20000);

      it("can directly sign", async () => {
        const result = await GetDevice().sign(path, txDetail);
        assert.deepEqual(result, signed);
      }).timeout(20000);
    });

    describe("Token transfer", () => {
      const path = `m/44'/784'/0'/0'/0'`;

      // const { key } = derivePath(path, seed.toString("hex"));
      // const publicKeyBytes = getPublicKey(key);
      // const raw32Bytes = publicKeyBytes.length === 33
      //   ? publicKeyBytes.slice(1)
      //   : publicKeyBytes;
      // const pk = new Ed25519PublicKey(raw32Bytes);
      // console.log('publickey2', Buffer.from(pk.toRawBytes()).toString("hex"))

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
        tokens: [
          {
            objectId: "0x5712f9678cfa5906448da28f3b4f23d7939399af31539ea4f496af399280b9be",
            version: 839757834,
            digest: "4Hz8WQ9qz46PkcFqend6bp8J1ijWv2dwUoUkDvSjSn15"
          }
        ]
      };

      it('query a SUI publickey', async () => {
        const data = SecuxSUI.preparePublickey(path);
        const rsp = await GetDevice().Exchange(data);
        txDetail.publickey = SecuxSUI.resolvePublickey(rsp);
        console.log('publickey', txDetail.publickey);
      });

      let signed;
      it("can sign token transfer", async () => {
        const result = await GetDevice().sign(path, txDetail);
        signed = result;

        console.log('signature', Buffer.from(signed.signature, 'base64').toString('hex'));
        console.log('bytes', Buffer.from(signed.bytes, 'base64').toString('hex'));
        assert.exists(signed.bytes);
        assert.exists(signed.signature);
      }).timeout(20000);
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
    //   }).timeout(20000);
    // });
  });
}


function RandomInt(max) {
  const value = Math.floor(Math.random() * max);
  return value.toString();
}
