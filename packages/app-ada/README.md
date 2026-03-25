[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-ada)](https://www.npmjs.com/package/@secux/app-ada)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-ada)](https://www.npmjs.org/package/@secux/app-ada)

# `@secux/app-ada`

> SecuX Hardware Wallet ADA API

## Usage

```ts
import { SecuxADA, AddressType } from "@secux/app-ada";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br />

## Examples
1. Get shelley address
    - base address
    ```ts
    const path = "m/1852'/1815'/0'";
    const address = await device.getAddress(path, AddressType.BASE);

    /*

    // transfer data to hardware wallet by custom transport layer
    const data = SecuxADA.prepareAddress(path);
    const response = await device.Exchange(data);
    const address = SecuxADA.resolveAddress(response, AddressType.BASE);

    */
    ```

    - reward address
    ```ts
    const path = "m/1852'/1815'/0'";
    const address = await device.getAddress(path, AddressType.REWARD);
    ```

2. Sign transaction
    - transfer asset
    ```ts
    const inputs = [
        {
            path: "m/1852'/1815'/0'",
            txId: "75c7d745c5212a11a0bfc2719c35bcc2f57fda88d7afb2eb3c5f2b02c3e99ccb",
            index: 1,
            amount: 12663894,
            // for custom transport layer, each utxo needs xpublickey.
            // xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
        },
        {
            path: "m/1852'/1815'/0'",
            txId: "6552b8f8b8b282542b07d6187fe80daa5b7a60461c97231f45c06fd97f8a3385",
            index: 1,
            amount: 2330624,
            // for custom transport layer, each utxo needs xpublickey.
            // xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
        },
    ];

    const output = {
        // daedalus or shelley address is accepted.
        address: "DdzFFzCqrhsjZHKn8Y9Txr4B9PaEtYcYp8TGa4gQTfJfjvuNLqvB8hPG35WRgK4FjcSYhgK7b2H24jLMeqmPoS3YhJq6bjStsx4BZVnn",
        amount: 13000000
    };

    const { raw_tx } = await device.sign(inputs, output, {
        changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
    });

    /*

    // transfer data to hardware wallet by custom transport layer.
    const { commandData, serialized } = SecuxADA.prepareSign(inputs, output, {
        changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
    });
    const response = await device.Exchange(commandData);
    const raw_tx = SecuxADA.resloveTransaction(response, serialized);

    */
    ```

    - stake
    ```ts
    const input = {
        path: "m/1852'/1815'/0'",
        utxo: [
            {
                txId: "75c7d745c5212a11a0bfc2719c35bcc2f57fda88d7afb2eb3c5f2b02c3e99ccb",
                index: 1,
                amount: 12663894,
            }
        ],
        changeAddress: "addr1qyk54vyyc856ngxermdzqhxnlk376ykkupru8rxcyryvg4kxs4un3x4r4rq422kwrtvc8p2a20dzhyr5v0n9lhwy2u6sfjujuz",
        // for custom transport layer, each utxo needs xpublickey.
        // xpublickey: "c232950d7c27b78542795ce4cad053e8dfaab7679ba5477563be5c60c1a4d0613fc81fd9bb8f30822c1252c29cc6af147831da44fb86acad6c04fcc95700b92b"
    };

    // pool id (support bech32 encoded)
    const pool = "ea595c6f726db925b6832af51795fd8a46e700874c735d204f7c5841";

    const { raw_tx } = await device.sign(
        input,
        pool,
        {
            // An account needs to have a stake pool registration certificate 
            // before it can participate in stake delegation between stake pools.
            needRegistration: true
        }
    );

    /*

    // transfer data to hardware wallet by custom transport layer.
    const { commandData, serialized } = SecuxADA.prepareStake(
        input,
        pool,
        {
            needRegistration: true
        }
    );
    const response = await device.Exchange(commandData);
    const raw_tx = SecuxADA.resolveTransaction(response, serialized);

    */
    ```

    - withdrawal
    ```ts
    const withdrawAmount = 150000;
    const { raw_tx } = await device.sign(input, withdrawAmount);

    /*

    // transfer data to hardware wallet by custom transport layer.
    const { commandData, serialized } = SecuxADA.prepareStake(input, withdrawAmount);
    const response = await device.Exchange(commandData);
    const raw_tx = SecuxADA.resolveTransaction(response, serialized);

    */
    ```

    - unstake (de-register staking key)
    ```ts
    const { raw_tx } = await device.sign(
        input, 
        {
            // With de-registration operation, the balance of reward address must be 0.
            withdrawAmount
        }
    );

    /*

    // transfer data to hardware wallet by custom transport layer.
    const { commandData, serialized } = SecuxADA.prepareUnstake(input, { withdrawAmount });
    const response = await device.Exchange(commandData);
    const raw_tx = SecuxADA.resolveTransaction(response, serialized);

    */
    ```


# API Reference
ADA package for SecuX device

**Kind**: global class  

* [SecuxADA](#SecuxADA)
    * [.addressConvert(xpublickey, type, [option])](#SecuxADA.addressConvert) ⇒ <code>string</code>
    * [.prepareAddress(pathWith3Depth)](#SecuxADA.prepareAddress) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolveAddress(response, type, [option])](#SecuxADA.resolveAddress) ⇒ <code>string</code>
    * [.prepareXPublickey(pathWith3Depth)](#SecuxADA.prepareXPublickey) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolveXPublickey(response)](#SecuxADA.resolveXPublickey) ⇒ <code>string</code>
    * [.prepareSign(inputs, output, [option])](#SecuxADA.prepareSign) ⇒ [<code>prepared</code>](#prepared)
    * [.resolveSignatureList(response)](#SecuxADA.resolveSignatureList) ⇒ <code>Array.&lt;string&gt;</code>
    * [.resolveTransaction(response, serialized)](#SecuxADA.resolveTransaction) ⇒ <code>string</code>
    * [.prepareStake(input, pool, [option])](#SecuxADA.prepareStake) ⇒ [<code>prepared</code>](#prepared)
    * [.prepareUnstake(input, [option])](#SecuxADA.prepareUnstake) ⇒ [<code>prepared</code>](#prepared)
    * [.prepareWithdraw(input, amount, [option])](#SecuxADA.prepareWithdraw) ⇒ [<code>prepared</code>](#prepared)

<br/>
<a name="SecuxADA.addressConvert"></a>

### **SecuxADA.addressConvert(xpublickey, type, [option]) ⇒ <code>string</code>**
*Convert bip32-publickey to ADA address.*

**Returns**: <code>string</code> - address  

| Param | Type | Description |
| --- | --- | --- |
| xpublickey | <code>string</code> \| <code>Buffer</code> | ada bip32-publickey |
| type | [<code>AddressType</code>](#AddressType) |  |
| [option] | [<code>AddressOption</code>](#AddressOption) |  |

<br/>
<a name="SecuxADA.prepareAddress"></a>

### **SecuxADA.prepareAddress(pathWith3Depth) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for address generation.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| pathWith3Depth | <code>string</code> | m/1852'/1815'/... |

<br/>
<a name="SecuxADA.resolveAddress"></a>

### **SecuxADA.resolveAddress(response, type, [option]) ⇒ <code>string</code>**
*Resolve address from response data.*

**Returns**: <code>string</code> - address  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |
| type | [<code>AddressType</code>](#AddressType) |  |
| [option] | [<code>AddressOption</code>](#AddressOption) |  |

<br/>
<a name="SecuxADA.prepareXPublickey"></a>

### **SecuxADA.prepareXPublickey(pathWith3Depth) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for bip32-publickey.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| pathWith3Depth | <code>string</code> | m/1852'/1815'/... |

<br/>
<a name="SecuxADA.resolveXPublickey"></a>

### **SecuxADA.resolveXPublickey(response) ⇒ <code>string</code>**
*Resolve bip32-publickey from response data.*

**Returns**: <code>string</code> - bip32-publickey (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br/>
<a name="SecuxADA.prepareSign"></a>

### **SecuxADA.prepareSign(inputs, output, [option]) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*


| Param | Type |
| --- | --- |
| inputs | [<code>Array.&lt;txInput&gt;</code>](#txInput) | 
| output | [<code>txOutput</code>](#txOutput) | 
| [option] | [<code>signOption</code>](#signOption) | 

<br/>
<a name="SecuxADA.resolveSignatureList"></a>

### **SecuxADA.resolveSignatureList(response) ⇒ <code>Array.&lt;string&gt;</code>**
*Reslove signatures from response data.*

**Returns**: <code>Array.&lt;string&gt;</code> - signature array of hex string  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br/>
<a name="SecuxADA.resolveTransaction"></a>

### **SecuxADA.resolveTransaction(response, serialized) ⇒ <code>string</code>**
*Resolve transaction for broadcasting.*

**Returns**: <code>string</code> - signed transaction (base64 encoded)  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |
| serialized | [<code>communicationData</code>](#communicationData) |  |

<br/>
<a name="SecuxADA.prepareStake"></a>

### **SecuxADA.prepareStake(input, pool, [option]) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*


| Param | Type | Description |
| --- | --- | --- |
| input | [<code>stakeInput</code>](#stakeInput) |  |
| pool | <code>string</code> | pool hash or id |
| [option] | [<code>stakeOption</code>](#stakeOption) |  |

<br/>
<a name="SecuxADA.prepareUnstake"></a>

### **SecuxADA.prepareUnstake(input, [option]) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*


| Param | Type |
| --- | --- |
| input | [<code>stakeInput</code>](#stakeInput) | 
| [option] | [<code>unstakeOption</code>](#unstakeOption) | 

<br/>
<a name="SecuxADA.prepareWithdraw"></a>

### **SecuxADA.prepareWithdraw(input, amount, [option]) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*


| Param | Type | Description |
| --- | --- | --- |
| input | [<code>stakeInput</code>](#stakeInput) |  |
| amount | <code>number</code> \| <code>string</code> | rewards |
| [option] | [<code>withdrawOption</code>](#withdrawOption) |  |

<br/>

<br/>
<br/>
<a name="AddressType"></a>

## AddressType : <code>enum</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| BASE | <code>number</code> | 0 |
| ENTERPRISE | <code>number</code> | 1 |
| POINTER | <code>number</code> | 2 |
| REWARD | <code>number</code> | 3 |
| BOOTSTRAPv1 | <code>number</code> | 4 |
| BOOTSTRAPv2 | <code>number</code> | 5 |

<br/>
<a name="PointerOption"></a>

## PointerOption : <code>object</code>
**Properties**

| Name | Type |
| --- | --- |
| slot | <code>number</code> | 
| txIndex | <code>number</code> | 
| certIndex | <code>number</code> | 

<br/>
<a name="AddressOption"></a>

## AddressOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [addressIndex] | <code>number</code> | account index |
| [stakeIndex] | <code>number</code> | stake key index |
| [pointer] | [<code>PointerOption</code>](#PointerOption) | option for Pointer address |
| [needChange] | <code>boolean</code> | use account index in exchange |

<br/>
<a name="txInput"></a>

## txInput : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | 3-depth path of CIP-1852 |
| xpublickey | <code>string</code> \| <code>Buffer</code> | ED25519 publickey from `path` |
| txId | <code>string</code> | referenced transaction hash |
| index | <code>number</code> | referenced transaction output index |
| amount | <code>number</code> \| <code>string</code> | referenced transaction output amount |
| [addressIndex] | <code>number</code> | default: 0 |
| [stakeIndex] | <code>number</code> | default: 0 |
| [tokens] | [<code>Array.&lt;token&gt;</code>](#token) |  |

<br/>
<a name="txOutput"></a>

## txOutput : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | receiver's address |
| amount | <code>number</code> \| <code>string</code> | amount of payment |

<br/>
<a name="signOption"></a>

## signOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [changeAddress] | <code>string</code> | default: sender's address |
| [fee] | <code>number</code> \| <code>string</code> |  |
| [TimeToLive] | <code>number</code> |  |

<br/>
<a name="stakeOption"></a>

## stakeOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [stakeIndex] | <code>number</code> | default: 0 |
| [needRegistration] | <code>boolean</code> | include registration or not |
| [fee] | <code>number</code> \| <code>string</code> |  |
| [TimeToLive] | <code>number</code> |  |

<br/>
<a name="withdrawOption"></a>

## withdrawOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [stakeIndex] | <code>number</code> | default: 0 |
| [fee] | <code>number</code> \| <code>string</code> |  |
| [TimeToLive] | <code>number</code> |  |
| [needVote] | <code>boolean</code> | enable vote default abstain  |

<br/>
<a name="unstakeOption"></a>

## unstakeOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [stakeIndex] | <code>number</code> | default: 0 |
| [withdrawAmount] | <code>boolean</code> | withdraw and de-registration |
| [fee] | <code>number</code> \| <code>string</code> |  |
| [TimeToLive] | <code>number</code> |  |

<br/>
<a name="utxo"></a>

## utxo : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| txId | <code>string</code> | referenced transaction hash |
| index | <code>number</code> | referenced transaction output index |
| amount | <code>number</code> \| <code>string</code> | referenced transaction output amount |
| [addressIndex] | <code>number</code> | default: 0 |

<br/>
<a name="stakeInput"></a>

## stakeInput : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | 3-depth path of CIP-1852 |
| utxo | [<code>Array.&lt;utxo&gt;</code>](#utxo) |  |
| changeAddress | <code>string</code> | owner's account |
| xpublickey | <code>string</code> \| <code>Buffer</code> | cardano bip32-publickey |
| [stakeIndex] | <code>number</code> | default: 0 |

<br/>
<a name="prepared"></a>

## prepared : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | [<code>communicationData</code>](#communicationData) | data for sending to device |
| serialized | [<code>communicationData</code>](#communicationData) |  |

<br/>
<a name="token"></a>

## token : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| policyId | <code>string</code> | token contractAddress |
| assetName | <code>number</code> | token symbol |
| quantity | <code>number</code> \| <code>string</code> | token amount |

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com
kenchang@secuxtech.com