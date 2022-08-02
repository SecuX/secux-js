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


import { ITransport } from "@secux/transport";
import { DeviceType, ProtocolV2 } from "@secux/transport/lib/interface";
import { SecuxDevice } from "@secux/protocol-device";
import { getBuffer } from "@secux/utility/lib/communication";
export { SecuxWebHID };


// report id use one byte
const PACKET_SIZE = ProtocolV2.USB_BUFFER_LEN - 1;


export const SECUX_HID_DEVICE = Object.freeze({
    TWALLET: Object.freeze({ vendorId: 0x1915, productId: 0x4298 })
});

const callback = () => { };

/**
 * HID transport module on web application for SecuX device
 */
class SecuxWebHID extends ITransport {
    #device: HIDDevice;
    #mcuVersion: string = '';
    #seVersion: string = '';
    #OnConnected: Function;
    #OnDisconnected: Function;

    constructor(device: HIDDevice, OnConnected: Function = callback, OnDisconnected: Function = callback) {
        super();

        this.packetSize = PACKET_SIZE;
        this.version = ITransport.PROTOCOLv2;
        this.#device = device;
        this.#OnConnected = OnConnected;
        this.#OnDisconnected = OnDisconnected;
    }

    /**
     * Create instance of SecuxcWebHID
     * @param {Function} OnConnected 
     * @param {Function} OnDisconnected 
     * @returns {SecuxWebHID}
     */
    static async Create(OnConnected: Function = callback, OnDisconnected: Function = callback): Promise<SecuxWebHID> {
        let device = await navigator.hid.requestDevice({ filters: Object.values(SECUX_HID_DEVICE) });
        if (!device || device.length === 0) throw Error("device not selected");

        return new SecuxWebHID(device[0], OnConnected, OnDisconnected);
    }

    /**
     * Connect to SecuX device by hid
     */
    async Connect() {
        try {
            await this.#device.open();

            this.#device.addEventListener("inputreport", (e) => {
                if (this.#device !== e.device) return;
                if (e.data.byteLength < 1) return;

                this.ReceiveData(Buffer.from(e.data.buffer));
            });

            this.#OnConnected();
            this.#DisconnectWatcher();

            const data = SecuxDevice.prepareGetVersion();
            const rsp = await this.Exchange(getBuffer(data));
            const { mcuFwVersion, seFwVersion } = SecuxDevice.resolveVersion(rsp);
            this.#mcuVersion = mcuFwVersion;
            this.#seVersion = seFwVersion;

            ITransport.deviceType = DeviceType.nifty;
            ITransport.mcuVersion = mcuFwVersion;
            ITransport.seVersion = seFwVersion;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Disconnect from SecuX device
     */
    async Disconnect() {
        if (this.#device.opened) await this.#device.close();
    }

    /**
     * Write data to SecuX device
     * @param {Buffer} data
     */
    async Write(data: Buffer) {
        const buf = Buffer.allocUnsafe(PACKET_SIZE);
        data.copy(buf);
        await this.#device.sendReport(0x81, buf);
    }

    /**
     * Check if device is belong to SecuX
     * @returns {boolean}
     */
    isSecuXDevice(): boolean {
        for (const secux of Object.values(SECUX_HID_DEVICE)) {
            if (this.#device.vendorId === secux.vendorId &&
                this.#device.productId === secux.productId)
                return true;
        }

        return false;
    }

    get DeviceName() { return this.#device.productName; }
    get DeviceType() { return DeviceType.nifty; }
    get MCU() { return this.#mcuVersion; }
    get SE() { return this.#seVersion; }


    #DisconnectWatcher() {
        const interval = 1000;

        const detect = async () => {
            if (!this) return;

            const devices = await navigator.hid.getDevices();
            const connected = devices.some((device: any) => device === this.#device);

            if (connected && this.#device.opened) {
                setTimeout(detect, interval);
            }
            else {
                this.#OnDisconnected();
                await this.Disconnect();
            }
        };

        setTimeout(detect, interval);
    }
}
