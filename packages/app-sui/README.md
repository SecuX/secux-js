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

2. Sign transaction (Transfer SUI)
```ts
const path = "m/44'/784'/0'/0'/0'";
const publickey = await device.getPublickey(path);
const content = {
publickey,
gasPrice: 1000,
gasBudget: 10000000,
gasPayment: [
{
objectId: "0x40375a2f57a9117387a32decab661159392ed0f862ead65fd32e7f3d61180b43",
version: 123,
digest: "6f5GfW6G6VvG88vYg4V9m8V9V8VvG88vYg4V9m8V9V8="
}
],
to: "0x89ad0df73ca35d48721c0ad146e2e50ed685324578b8a531f8f35f1c44ba278d",
amount: 1000000000 // 1 SUI
};

// sign
const { bytes, signature } = await device.sign(path, content);

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = await SecuxSUI.prepareSign(path, content);
const response = await device.Exchange(commandData);
const { bytes, signature } = SecuxSUI.resolveTransaction(response, {
rawTx,
publickey,
curve: SuiCurve.ED25519
});

*/
```

3. Sign transaction (Transfer Token/NFT)
```ts
const content = {
publickey,
gasPrice: 1000,
gasBudget: 10000000,
gasPayment: [
{
objectId: "0x40375a2f57a9117387a32decab661159392ed0f862ead65fd32e7f3d61180b43",
version: 123,
digest: "6f5GfW6G6VvG88vYg4V9m8V9V8VvG88vYg4V9m8V9V8="
}
],
to: "0x89ad0df73ca35d48721c0ad146e2e50ed685324578b8a531f8f35f1c44ba278d",
// for tokens
amount: 1000000,
tokens: [
{
objectId: "0x...",
version: 1,
digest: "..."
}
],
// or for nfts
/*
nfts: [
{
objectId: "0x...",
version: 1,
digest: "..."
}
]
*/
};

const { bytes, signature } = await device.sign(path, content);
```

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