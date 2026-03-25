/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu
Copyright Chang Chia-Yu

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


import { cardano } from "./load_lib";


export function isShelleyAddress(address: string) {
    try {
        cardano.Address.from_bech32(address);
        return true;
    } catch (error) { }

    return false;
}

export function isAddress(address: string) {
    if (cardano.ByronAddress.is_valid(address)) return true;

    return isShelleyAddress(address);
}

export function isPool(pool: string) {
    if (!pool.startsWith("pool")) return false;

    try {
        cardano.Ed25519KeyHash.from_bech32(pool);
    }
    catch {
        return false;
    }

    return true;
}