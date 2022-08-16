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
import { DeviceType } from "@secux/transport/lib/interface";
import { getBuffer } from "@secux/utility/lib/communication";
import { SecuxDevice } from "@secux/protocol-device";
export { SecuxWebUSB };


const PACKET = 64;
const CONFIGURATION_ID = 1;
const INTERFACE_ID = 0;
const ENDPOINT_ID = 1;

export const SECUX_USB_DEVICE = Object.freeze({
    BOOTLOADER: Object.freeze({ vendorId: 0x1915, productId: 0x4296 }),
    MCU: Object.freeze({ vendorId: 0x1915, productId: 0x4297 })
});

const callback = () => { };

/**
 * USB transport module on web application for SecuX device
 */
class SecuxWebUSB extends ITransport {
    #device: USBDevice;
    #connected: boolean = false;
    #mcuVersion: string = '';
    #seVersion: string = '';
    #OnConnected: Function;
    #OnDisconnected: Function;

    constructor(device: USBDevice, OnConnected: Function = callback, OnDisconnected: Function = callback) {
        super();

        this.packetSize = PACKET;
        this.version = ITransport.PROTOCOLv1;
        this.#device = device;
        this.#OnConnected = OnConnected;
        this.#OnDisconnected = OnDisconnected;
    }

    /**
     * Create instance of SecuxcWebUSB
     * @param {Function} OnConnected 
     * @param {Function} OnDisconnected 
     * @returns {SecuxWebUSB}
     * 
     * @example
     * const device = await SecuxcWebUSB.create();
     * await device.Connect();
     */
    static async Create(OnConnected: Function = callback, OnDisconnected: Function = callback): Promise<SecuxWebUSB> {
        let device = await navigator.usb.requestDevice({ filters: Object.values(SECUX_USB_DEVICE) });

        return new SecuxWebUSB(device, OnConnected, OnDisconnected);
    }

    /**
     * Connect to SecuX device by usb
     */
    async Connect() {
        try {
            await this.#device.open();
            this.#OnConnected();

            await this.#device.selectConfiguration(CONFIGURATION_ID);
            await this.#device.claimInterface(INTERFACE_ID);

            this.#connected = true;
            this.#DisconnectWatcher();
            this.#Listener();

            if (this.#device.productId !== SECUX_USB_DEVICE.BOOTLOADER.productId) {
                const data = SecuxDevice.prepareGetVersion();
                const rsp = await this.Exchange(getBuffer(data));
                const { mcuFwVersion, seFwVersion } = SecuxDevice.resolveVersion(rsp);
                this.#mcuVersion = mcuFwVersion;
                this.#seVersion = seFwVersion;

                ITransport.mcuVersion = mcuFwVersion;
                ITransport.seVersion = seFwVersion;
            }

            ITransport.deviceType = DeviceType.crypto;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Disconnect from SecuX device
     */
    async Disconnect() {
        if (this.#device.opened) {
            await this.#device.releaseInterface(INTERFACE_ID);
            await this.#device.reset();
            await this.#device.close();
        }
    }

    /**
     * Write data to SecuX device
     * @param {Buffer} data
     */
    async Write(data: Buffer) {
        let buf = data;
        if (this.#device.productId !== SECUX_USB_DEVICE.BOOTLOADER.productId) {
            buf = Buffer.allocUnsafe(PACKET);
            data.copy(buf);
        }

        const result = await this.#device.transferOut(ENDPOINT_ID, buf);

        if (result.status !== "ok")
            throw Error(`Failed to write data to device, got transfer status "${result.status}".`);
    }

    /**
     * Check if SecuX device is in bootloader mode
     * @returns {boolean}
     */
    isBootLoader(): boolean {
        return (
            this.#device.vendorId === SECUX_USB_DEVICE.BOOTLOADER.vendorId &&
            this.#device.productId === SECUX_USB_DEVICE.BOOTLOADER.productId
        );
    }

    /**
     * Check if device is belong to SecuX
     * @returns {boolean}
     */
    isSecuXDevice(): boolean {
        return (
            (this.#device.vendorId === SECUX_USB_DEVICE.MCU.vendorId && this.#device.productId === SECUX_USB_DEVICE.MCU.productId) ||
            (this.#device.vendorId === SECUX_USB_DEVICE.BOOTLOADER.vendorId && this.#device.productId === SECUX_USB_DEVICE.BOOTLOADER.productId)
        );
    }

    get DeviceName() { return this.#device.productName; }
    get DeviceType() { return DeviceType.crypto; }
    get MCU() { return this.#mcuVersion; }
    get SE() { return this.#seVersion; }

    async #Read(): Promise<Buffer> {
        const receive = await this.#device.transferIn(ENDPOINT_ID, PACKET);

        if (receive.status !== "ok")
            throw Error(`Failed to read data from device, got transfer status "${receive.status}".`);

        if (receive.data) return Buffer.from(receive.data.buffer);
        return Buffer.alloc(0);
    }

    #Listener() {
        const interval = 1;

        const receive = async () => {
            if (!this) return;
            if (!this.#connected) return;

            const data = await this.#Read();
            if (data.length > 0) this.ReceiveData(data);

            setTimeout(receive, interval);
        };

        setTimeout(receive, interval);
    }

    #DisconnectWatcher() {
        const interval = 1000;

        const detect = async () => {
            if (!this) return;

            const devices = await navigator.usb.getDevices();
            this.#connected = devices.some((device: any) => device === this.#device);

            if (this.#connected && this.#device.opened) {
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
