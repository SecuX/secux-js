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


import { StatusCode } from "@secux/utility/lib/communication";


export type TransportConfig = {
    timeout?: number
};

/**
 * @property {number} cla
 * @property {number} ins
 * @property {number} [p1]
 * @property {number} [p2]
 * @property {Buffer} [data]
 */
export interface IAPDURequest {
    cla: number;
    ins: number;
    p1?: number;
    p2?: number;
    data?: Buffer;
}

/**
 * @property {number} dataLength
 * @property {Buffer} data
 * @property {StatusCOde} status
 */
export interface IAPDUResponse {
    dataLength: number;
    data: Buffer;
    status: StatusCode;
}

export const ProtocolV2 = Object.freeze({
    HEAD_PREFIX: 0x80,
    TAIL_PREFIX: 0x6f,
    SERIAL_START: 0x70,
    SERIAL_END: 0x7f,
    USB_BUFFER_LEN: 64
});

export enum DeviceType {
    crypto = "crypto",
    nifty = "nifty"
}