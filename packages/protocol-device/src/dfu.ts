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


import * as crc32 from "crc-32";
import { Logger } from "@secux/utility";
import { communicationData, getBuffer, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
import { Package } from "./package";
const logger = Logger?.child({ id: "dfu" });


type Exchange = {
    data: communicationData,
    resolve?: (response: communicationData) => void
}

type Response = {
    data: communicationData,
    needResponse: boolean,
    progress: number
}

const cmdQueue: Array<Exchange> = [];
let updateTotal = 0, updateSize = 0, _isUSB = true, _packetSize = 0;


export function beginUpdate(data: communicationData, isUSB: boolean, packetSize: number = 64): Response {
    updateTotal = 0;
    updateSize = 0;
    _isUSB = isUSB;
    _packetSize = packetSize - packetSize % 16;
    logger?.info(`packet size: ${_packetSize}`);
    cmdQueue.length = 0;

    const pkg = Package.loadSync(getBuffer(data));
    const base = pkg.getBaseImageSync();
    const app = pkg.getAppImageSync();

    if (base) {
        logger?.info("updating base image");
        update(base.initData, base.imageData);
    }
    if (app) {
        logger?.info("updating app image");
        update(app.initData, app.imageData);
    }

    return wrapResult({
        data: cmdQueue[0].data,
        needResponse: !!cmdQueue[0].resolve,
        progress: Math.round(updateSize / updateTotal * 10000) / 100
    });
}

const empty = toCommunicationData(Buffer.alloc(0));
export function proceed(response: communicationData): Response {
    const exchange = cmdQueue.shift();
    if (!exchange) return wrapResult({ data: empty, needResponse: false, progress: 0 });

    logger?.debug(`send: ${exchange.data.toString("hex")}`);
    if (response.length > 0) logger?.debug(`recv: ${response.toString("hex")}`);

    if (exchange.resolve) {
        exchange.resolve(response);
    }
    else {
        // wait for nordic chip processing
        if (_isUSB) delaySync();
        updateSize += getBuffer(exchange.data).length - 1;
    }

    if (cmdQueue.length < 1) return wrapResult({ data: empty, needResponse: false, progress: 0 });

    return wrapResult({
        data: cmdQueue[0].data,
        needResponse: !!cmdQueue[0].resolve,
        progress: Math.round(updateSize / updateTotal * 10000) / 100
    });
}


function update(init: Uint8Array, firmware: Uint8Array) {
    cmdQueue.push({
        data: sendControl(Buffer.from([0x06, 0x01])),
        resolve: (response: communicationData) => {
            const rsp = recvControl(response);
            const maxSize = rsp.readUInt32LE(0);
            const offset = rsp.readUInt32LE(4);
            const crc = rsp.readInt32LE(8);
            logger?.info(`maxSize: ${maxSize}`);
            logger?.info(`offset: ${offset}`);
            logger?.info(`crc: ${crc}`);

            logger?.info("send init packet");
            cmdQueue.unshift(
                ...transferWithSize(init, Buffer.from([0x01, 0x01]), maxSize)
            );
        }
    });

    cmdQueue.push({
        data: sendControl(Buffer.from([0x06, 0x02])),
        resolve: (response: communicationData) => {
            const rsp = recvControl(response);
            const maxSize = rsp.readUInt32LE(0);
            const offset = rsp.readUInt32LE(4);
            logger?.info(`maxSize: ${maxSize}`);
            logger?.info(`offset: ${offset}`);

            logger?.info("send firmware packet");
            cmdQueue.unshift(
                ...transferWithSize(firmware, Uint8Array.from([0x01, 0x02]), maxSize)
            );
        }
    });

    updateTotal += init.length + firmware.length;

    return cmdQueue[0].data;
}

function sendControl(operation: Uint8Array, data?: Uint8Array) {
    const buf = (data) ? Buffer.from([...operation, ...data]) : Buffer.from(operation);
    return toCommunicationData(buf);
}

function recvControl(response: communicationData) {
    const rsp = getBuffer(response);
    logger?.info(`sendControl response: ${rsp.toString("hex")}`);

    const result = rsp.readUInt8(2);
    if (result === 0x01) {
        return rsp.slice(3);
    }

    throw Error("operation fail");
}

function transferWithSize(data: Uint8Array, createType: Uint8Array, maxSize: number) {
    const jobs: Array<Exchange> = [];

    // May not need to clean the buffer on device.
    // transfer(Buffer.alloc(maxSize), createType, maxSize);

    let n = Math.ceil(data.length / maxSize);
    for (let i = 0; i < n; i++) {
        const chunk = data.subarray(i * maxSize, (i + 1) * maxSize);
        const cmds = transfer(chunk, createType, maxSize);
        cmds[cmds.length - 1].resolve = (response: communicationData) => {
            const rsp = recvControl(response);
            const transfered = rsp.readUInt32LE(0);
            const crc = rsp.readInt32LE(4);

            if (checkCRC(data.slice(0, transfered), crc)) {
                cmdQueue.unshift({
                    data: sendControl(Buffer.from([0x04])),
                    resolve: recvControl
                });
            }
            else {
                logger?.debug(`chunk: ${Buffer.from(chunk).toString("hex")}`);
                logger?.debug(`transfered: ${Buffer.from(data.slice(0, transfered)).toString("hex")}`);
                throw Error("data transfer error");
            }
        };

        jobs.push(...cmds);
    }

    return jobs;
}

function transfer(data: Uint8Array, createType: Uint8Array, maxSize: number): Array<Exchange> {
    const jobs: Array<Exchange> = [];
    const lenBuffer = Buffer.alloc(4);
    lenBuffer.writeUInt32LE(data.length);
    jobs.push({
        data: sendControl(createType, lenBuffer),
        resolve: recvControl
    });

    const packets = buildPacketBuffer(data, _isUSB, Math.min(maxSize, _packetSize) - 4);
    for (const packet of packets) {
        jobs.push({
            data: toCommunicationData(packet)
        });
    }

    jobs.push({
        data: sendControl(Buffer.from([0x03])),
        resolve: recvControl
    });

    return jobs;
}

function checkCRC(data: Uint8Array, crc: number) {
    return crc === crc32.buf(data);
}

function buildPacketBuffer(buffer: Uint8Array, isUSB: boolean, packetSize: number = 60) {
    const nBlocks = Math.ceil(buffer.length / packetSize);
    const blocks: Buffer[] = [];
    for (let i = 0; i < nBlocks; i++) {
        const chunkData = buffer.slice(i * packetSize, (i + 1) * packetSize);
        const packet = (isUSB) ? Buffer.from([0x08, ...chunkData]) : Buffer.from(chunkData);

        blocks.push(packet);
    }

    return blocks;
}

const delayTime = 10;
function delaySync() {
    const start = Date.now();
    let end = start;

    while (end < start + delayTime) {
        end = Date.now();
    }
}