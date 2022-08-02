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
import { getBuffer, StatusCode, TransportStatusError } from "@secux/utility/lib/communication";
import { SecuxDevice } from "@secux/protocol-device";
import { Devices } from "./interface";
export { SecuxWebBLE };


const callback = () => { };


/**
 * Bluetooth transport module on web application for SecuX device
 */
class SecuxWebBLE extends ITransport {
    #device: BluetoothDevice;
    #mcuVersion: string = '';
    #seVersion: string = '';
    #reader?: BluetoothRemoteGATTCharacteristic;
    #writer?: BluetoothRemoteGATTCharacteristic;
    #type?: DeviceType;
    #OnConnected: Function;
    #OnDisconnected: Function;

    constructor(device: BluetoothDevice, OnConnected?: Function, OnDisconnected?: Function) {
        super();

        this.#device = device;
        this.#OnConnected = OnConnected ?? callback;
        this.#OnDisconnected = OnDisconnected ?? callback;
    }

    /**
     * Create instance of SecuxWebBLE
     * @param {Function} OnConnected 
     * @param {Function} OnDisconnected 
     * @returns {SecuxWebBLE}
     */
    static async Create(OnConnected?: Function, OnDisconnected?: Function, devices?: Array<DeviceType>): Promise<SecuxWebBLE> {
        const types = devices ?? [DeviceType.crypto];
        const filters = Devices
            .filter(x => types.includes(x.TYPE))
            .map(x => ({ services: [x.SERVICE] }));
        const device = await navigator.bluetooth.requestDevice({
            filters,
            optionalServices: [...Devices.map(x => x.PRIMARY)]
        });

        return new SecuxWebBLE(device, OnConnected ?? callback, OnDisconnected ?? callback);
    }

    /**
     * Connect to SecuX device by bluetooth on web
     */
    async Connect() {
        const ValueChangedId = 'characteristicvaluechanged';
        const handleNotifications = (event: Event) => {
            //@ts-ignore
            const value = event.target?.value;
            if (value.buffer) this.ReceiveData(Buffer.from(value.buffer));
        }

        this.#device.addEventListener('gattserverdisconnected', () => {
            this.#reader!.removeEventListener(ValueChangedId, handleNotifications)
            this.#reader = undefined;
            this.#writer = undefined;

            this.#OnDisconnected();
        });

        const server = await this.#device.gatt!.connect();
        if (!server) { throw "Cannot connect to device: BluetoothDevice.gatt is undefined"; }
        this.#OnConnected();

        const services = await server.getPrimaryServices();
        const { service, uuid } = this.#identify(services);
        this.#reader = await service.getCharacteristic(uuid.TX);
        this.#writer = await service.getCharacteristic(uuid.RX);
        this.#type = uuid.TYPE;
        this.version = uuid.PROTOCOL;
        this.packetSize = uuid.PACKET;

        await this.#reader.startNotifications();
        this.#reader.addEventListener(ValueChangedId, handleNotifications);

        ITransport.deviceType = this.#type;
        if (this.#type === DeviceType.nifty) {
            await this.#setFirwmareVersion();
        }
    }

    /**
     * Disconnect from Secux Device
     */
    async Disconnect() {
        this.#device.gatt!.disconnect();
        this.#reader = undefined;
        this.#writer = undefined;
    }

    /**
     * Write data to SecuX device
     * @param {Buffer} data
     */
    async Write(data: Buffer) {
        await this.#writer!.writeValueWithoutResponse(data);

        // send too fast will fail to update SE
        await new Promise(resolve => setTimeout(resolve, 1));
    }

    /**
     * OTP for Secux Device
     * @param {string} otp otp code
     * @returns {boolean} True if OTP is authenticated
     */
    async SendOTP(otp: string): Promise<boolean> {
        const recv = await this.Exchange(Buffer.from(otp));
        const dataLength = recv.readUInt16LE(0);
        const status = recv.readUInt16BE(2 + dataLength); // big endian
        if (status !== StatusCode.SUCCESS) {
            throw new TransportStatusError(status);
        }

        await this.#setFirwmareVersion();

        return true;
    }

    get DeviceName() { return this.#device.name; }
    get DeviceType() { return this.#type ?? ''; }
    get MCU() { return this.#mcuVersion; }
    get SE() { return this.#seVersion; }


    #identify(services: Array<BluetoothRemoteGATTService>) {
        for (const uuid of Object.values(Devices)) {
            const service = services.find(x => x.uuid === uuid.PRIMARY);
            if (!!service) {
                return { service, uuid };
            }
        }

        throw Error("Cannot find related GATTService");
    }

    async #setFirwmareVersion() {
        const data = SecuxDevice.prepareGetVersion();
        const rsp = await this.Exchange(getBuffer(data));
        const { mcuFwVersion, seFwVersion } = SecuxDevice.resolveVersion(rsp);
        this.#mcuVersion = mcuFwVersion;
        this.#seVersion = seFwVersion;

        ITransport.mcuVersion = mcuFwVersion;
        ITransport.seVersion = seFwVersion;
    }
}
