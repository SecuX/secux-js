[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-sui)](https://www.npmjs.com/package/@secux/app-sui)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-sui)](https://www.npmjs.org/package/@secux/app-sui)

# `@secux/app-sui`

> SecuX Hardware Wallet SUI API

## Usage

```ts
import { SecuxSUI } from "@secux/app-sui";
import { SuiCurve } from "@secux/app-sui/interface";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br />

## Examples
1. Get address of bip44 path
```ts
const path = "m/44'/784'/0'/0'/0'";
const address = await device.getAddress(path);

/*

// transfer data to hardware wallet by custom transport layer.
const data = SecuxSUI.prepareAddress(path);
const response = await device.Exchange(data);
const address = SecuxSUI.resolveAddress(response);

*/
```

2. Sign with explicit Coin/Object inputs

Use `prepareSignObject` when the transaction consumes owned `Coin` objects or
transfers NFT objects. Transaction building is fully offline; all object refs and
gas data must already be resolved by the backend.

```ts
const path = "m/44'/784'/0'/0'/0'";
const publickey = await device.getPublickey(path);
const content = {
  publickey,
  to: "0x89ad0df73ca35d48721c0ad146e2e50ed685324578b8a531f8f35f1c44ba278d",
  amount: "1000000000", // 1 SUI in MIST
  type: "0x2::sui::SUI",
  gasPrice: "1000",
  gasBudget: "5000000",
  gasPayment: [{ objectId: "0x...", version: "123", digest: "..." }],
  expiration: { None: true },
};

const { commandData, rawTx } = await SecuxSUI.prepareSignObject(path, content);
const response = await device.Exchange(commandData);
const { bytes, signature } = SecuxSUI.resolveTransaction(response, {
  rawTx,
  publickey,
  curve: SuiCurve.ED25519,
});
```

For a custom token object transfer, add `tokens` containing the token Coin
object refs. For an NFT transfer, use `nfts` instead of `amount`/`tokens`.

3. Sign from Address Balance

Use `prepareSignAddress` only when both the transferred asset and, when
`gasPayment` is empty, gas are paid from Address Balance. It constructs the
official Sui framework calls `0x2::balance::redeem_funds` and
`0x2::balance::send_funds` locally and does not require a Sui client.

```ts
const content = {
  publickey,
  to: "0x89ad0df73ca35d48721c0ad146e2e50ed685324578b8a531f8f35f1c44ba278d",
  amount: "1011778",
  type: "0x...::usdc::USDC",
  gasPrice: "1000",
  gasBudget: "5000000",
  gasPayment: [],
  expiration: {
    ValidDuring: {
      minEpoch: "555",
      maxEpoch: "556",
      minTimestamp: null,
      maxTimestamp: null,
      chain: "<base58 encoded 32-byte chain identifier>",
      nonce: 123456789,
    },
  },
};

const { commandData, rawTx } = await SecuxSUI.prepareSignAddress(path, content);
```

An empty `gasPayment` explicitly selects Address Balance gas and requires an
`expiration`. Supplying Coin object refs selects object gas.

4. Sign a backend-resolved TransactionKind

Use `prepareSignBalance` when an online backend has built an official
`TransactionKind`, for example from `Transaction#balance()`. The frontend stays
offline: the backend returns the BCS TransactionKind plus the complete GasData,
and the SDK assembles and signs `TransactionData` locally.

```ts
const content = {
  publickey,
  to: "0x89ad0df73ca35d48721c0ad146e2e50ed685324578b8a531f8f35f1c44ba278d",
  amount: "1000000000",
  type: "0x2::sui::SUI",
  transactionKind: backendResult.transactionKind, // base64 BCS TransactionKind
  gasPrice: backendResult.gasPrice,
  gasBudget: backendResult.gasBudget,
  gasPayment: backendResult.gasPayment,
  gasOwner: backendResult.gasOwner,
  expiration: backendResult.expiration,
};

const { commandData, rawTx } = await SecuxSUI.prepareSignBalance(path, content);
```

`prepareSignBalance` does not sign arbitrary serialized transactions. Before
signing it validates sender, recipient, exact amount, coin type and command
shape. Only owned object/pure/address-withdrawal inputs, merge/split commands,
and these Sui framework calls are accepted:

- `0x2::balance::redeem_funds`
- `0x2::balance::send_funds`
- `0x2::coin::redeem_funds`
- `0x2::coin::into_balance`
- `0x2::coin::send_funds`

Custom Move packages and unrelated transaction commands are rejected.

`prepareSign(path, content)` remains available as a dispatcher:

- `transactionKind` present: `prepareSignBalance`
- `tokens` or `nfts` present: `prepareSignObject`
- otherwise: `prepareSignAddress`

## Backend and offline signing boundary

The frontend signing APIs do not create an `SuiClient` and do not query the
network. The backend must resolve current object refs, gas price, gas budget,
GasData, expiration and any TransactionKind that depends on chain state. Dry-run
the exact full transaction bytes assembled from those values before returning
the signing content. The signed bytes submitted for broadcast must be identical
to the dry-run bytes.

## Firmware content v2

Deterministic firmware vectors cover SUI and custom tokens across:

- pure Coin/Object transfer
- pure Address Balance transfer
- backend-resolved TransactionKind using address, object or mixed funding
- object gas or Address Balance gas

Generate all 16 vectors with:

```sh
npm run vectors:firmware:v2 --workspace=@secux/app-sui
```

The generated fixtures are under `__tests__/firmware-content-v2`. They include
the request, raw TransactionData, intent signing payload, APDU command, decoded
transaction and expected policy fields.

The fixture mnemonic is only for deterministic testing. Sui signing is not
restricted to 24-word mnemonics; valid 12-, 18- and 24-word BIP39 seeds can sign.
However, fixture public keys, sender addresses and transaction bytes are tied to
the fixture seed. A physical device must use that seed, or the vectors must be
regenerated for the device's public key and sender, for signature verification
and broadcast to succeed.

# API Reference
SUI package for SecuX device

**Kind**: global class  

* [SecuxSUI](#SecuxSUI)
    * [.addressConvert(publickey, curve)](#SecuxSUI.addressConvert) ⇒ <code>string</code>
    * [.prepareAddress(path)](#SecuxSUI.prepareAddress) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolveAddress(response, curve)](#SecuxSUI.resolveAddress) ⇒ <code>string</code>
    * [.preparePublickey(path)](#SecuxSUI.preparePublickey) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolvePublickey(response)](#SecuxSUI.resolvePublickey) ⇒ <code>string</code>
    * [.prepareSign(path, content)](#SecuxSUI.prepareSign) ⇒ [<code>prepared</code>](#prepared)
    * [.resolveSignature(response)](#SecuxSUI.resolveSignature) ⇒ <code>string</code>
    * [.resolveTransaction(response, params)](#SecuxSUI.resolveTransaction) ⇒ <code>string</code>

<br />
<a name="SecuxSUI.addressConvert"></a>

### **SecuxSUI.addressConvert(publickey, curve) ⇒ <code>string</code>**
*Convert bip32-publickey to SUI address.*

**Returns**: <code>string</code> - address  

| Param | Type | Description |
| --- | --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | ada bip32-publickey |
| curve | <code>EllipticCurve</code> |  |

<br />
<a name="SecuxSUI.prepareAddress"></a>

### **SecuxSUI.prepareAddress(path) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for address generation.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/1852'/1815'/... |

<br />
<a name="SecuxSUI.resolveAddress"></a>

### **SecuxSUI.resolveAddress(response, curve) ⇒ <code>string</code>**
*Resolve address from response data.*

**Returns**: <code>string</code> - address  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |
| curve | <code>SuiCurve</code> |  |

<br />
<a name="SecuxSUI.preparePublickey"></a>

### **SecuxSUI.preparePublickey(path) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for ed25519 publickey.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path (hardened child key), ex: m/44'/784'/0'/0'/0' |

<br />
<a name="SecuxSUI.resolvePublickey"></a>

### **SecuxSUI.resolvePublickey(response) ⇒ <code>string</code>**
*Resove ed25519 publickey from response data.*

**Returns**: <code>string</code> - ed25519 publickey (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br />
<a name="SecuxSUI.prepareSign"></a>

### **SecuxSUI.prepareSign(path, content) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*

**Returns**: [<code>prepared</code>](#prepared) - prepared object  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/195'/... |
| content | [<code>transferData</code>](#transferData) | transaction object |

<br />
<a name="SecuxSUI.resolveSignature"></a>

### **SecuxSUI.resolveSignature(response) ⇒ <code>string</code>**
*Reslove signatures from response data.*

**Returns**: <code>string</code> - signature (base64 encoded)  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br />
<a name="SecuxSUI.resolveTransaction"></a>

### **SecuxSUI.resolveTransaction(response, params) ⇒ <code>string</code>**
*Resolve transaction for broadcasting.*

**Returns**: <code>string</code> - signed raw transaction  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |
| params | <code>TransactionObject</code> | raw transaction |

<br />

<br />
<br />
<a name="transferData"></a>

## transferData : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| from | <code>string</code> | sending address |
| to | <code>string</code> | receiving address |
| amount | <code>number</code> | transfer amount |
| blockID | <code>string</code> |  |
| blockNumber | <code>number</code> |  |
| timestamp | <code>number</code> |  |
| [feeLimit] | <code>number</code> |  |
| [expiration] | <code>number</code> |  |

<br />
<a name="prepared"></a>

## prepared : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | [<code>communicationData</code>](#communicationData) | data for sending to device |
| rawTx | [<code>communicationData</code>](#communicationData) | unsigned raw transaction |

<br />

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br />
kenchang@secuxtech.com --
