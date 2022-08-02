/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


Object.defineProperty(global, "process", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: {
        ...process,
        env: {
            ...process.env,
            SECUX_PLATFROM: "service",
        }
    }
});

Object.defineProperty(global, "ow", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: Object.freeze(require("ow"))
});

Object.defineProperty(global, "@secux/utility", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: Object.freeze(require("@secux/utility"))
});

Object.defineProperty(global, "@secux/protocol-transaction", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: Object.freeze(require("@secux/protocol-transaction"))
});

if (!global["@secux/transport"]) {
    global["@secux/transport"] = {
        ITransport: {}
    };
}


export { isSupportedCoin, toExtenededPublicKey, Signature } from "@secux/utility";
export { to_L1_APDU } from "@secux/utility/lib/communication";
export { SecuxTransactionTool } from "@secux/protocol-transaction";
export { SecuxDevice } from "@secux/protocol-device";
export { SecuxScreenDevice } from "@secux/protocol-device/lib/protocol-screendevice";
export { Buffer } from "buffer/";


import * as R from "../../transport/src/resolver";
import { getBuffer, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
const ResolverV1 = new R.CommandResolver(new R.BaseResolver());
const ResolverV2 = new R.APDUResolver(new R.NotifyResolver(new R.BaseResolverV2()));
export function SetCommandV1(data) {
    ResolverV1.Sent = getBuffer(data);
}
export function ReceiveDataV1(data) {
    return receive(ResolverV1, data);
}
export function SetCommandV2(data) {
    ResolverV2.Sent = getBuffer(data);
}
export function ReceiveDataV2(data) {
    return receive(ResolverV2, data);
}

function receive(resolver, data) {
    try {
        const result = R.IResolver.handleData.call(resolver, getBuffer(data));

        return wrapResult({
            data: toCommunicationData(result.data),
            status: result.response.status,
            isNotify: result.isNotify
        });
    } catch (error) {
        R.IResolver.resetAll.call(resolver);
        throw error;
    }
}
