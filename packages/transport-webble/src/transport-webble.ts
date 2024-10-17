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


const callback = () => {};
const ValueChangedId = "characteristicvaluechanged";
const GattDisconnectedId = "gattserverdisconnected";


/**
 * Bluetooth transport module on web application for SecuX device
 */
class SecuxWebBLE extends ITransport {
    #device: BluetoothDevice;
    #mcuVersion: string = '';
    #seVersion: string = '';
    #model: string = '';
    #deviceId: string = '';
    #customerId: string = '';
    #reader?: BluetoothRemoteGATTCharacteristic;
    #writer?: BluetoothRemoteGATTCharacteristic;
    #receivedData?: Buffer = undefined;
    #type?: DeviceType;
    #connected: boolean = false;
    #OnConnected: Function;
    #OnDisconnected: Function;

    constructor(device: BluetoothDevice, OnConnected?: Function, OnDisconnected?: Function) {
        super();

        this.#device = device;
        this.#OnConnected = OnConnected ?? callback;
        this.#OnDisconnected = OnDisconnected ?? callback;

        this.#device.addEventListener(GattDisconnectedId, () => {
            this.#reader!.removeEventListener(ValueChangedId, this.#handleNotifications);
            this.#reader = undefined;
            this.#writer = undefined;

            if (this.#connected) this.#OnDisconnected();
        });
    }

    /**
     * Create instance of SecuxWebBLE
     * @param {Function} OnConnected 
     * @param {Function} OnDisconnected 
     * @returns {SecuxWebBLE}
     */
    static async Create(OnConnected?: Function, OnDisconnected?: Function, devices?: Array<DeviceType>): Promise<SecuxWebBLE> {
        const types = devices ?? [DeviceType.crypto, DeviceType.shield];
        const filters = types.map(x => ({
            services: [Devices[x].SERVICE],
            namePrefix: Devices[x].PREFIX,
            // hardware bluetooth issue on 1.4 GHz 4-Core Intel Core i5, 13-inch, 2020
            // manufacturerData: Devices[x].MANUFACTURE,
        }));

        const excludedDevices = Object.values(Devices).filter(x => !types.includes(x.TYPE));
        const excludedFilters: any[] = [];
        for (const def of excludedDevices) {
            if (!def.PREFIX) continue;

            excludedFilters.push({ namePrefix: def.PREFIX });
        }

        const device = await navigator.bluetooth.requestDevice({
            filters,
            //@ts-ignore
            exclusionFilters: excludedFilters.length > 0 ? excludedFilters : undefined,
            optionalServices: Object.values(Devices).map(x => x.PRIMARY),
        });

        return new SecuxWebBLE(device, OnConnected ?? callback, OnDisconnected ?? callback);
    }

    /**
     * Connect to SecuX device by bluetooth on web
     */
    async Connect() {
        const server = await this.#device.gatt!.connect();
        if (!server) { throw Error("Cannot connect to device: BluetoothDevice.gatt is undefined"); }

        const services = await server.getPrimaryServices();
        const { service, uuid } = this.#identify(services);
        this.#reader = await service.getCharacteristic(uuid.TX);
        this.#writer = await service.getCharacteristic(uuid.RX);
        this.#type = uuid.TYPE;
        this.version = uuid.PROTOCOL;
        this.packetSize = uuid.PACKET;
        ITransport.deviceType = this.#type;

        await this.#reader.startNotifications();
        if (this.#type === DeviceType.nifty) {
            try {
                this.#reader.addEventListener(ValueChangedId, this.#handlePairing);
                await this.#checkPairing();
            }
            finally {
                this.#reader.removeEventListener(ValueChangedId, this.#handlePairing);
                this.#reader.addEventListener(ValueChangedId, this.#handleNotifications);
            }

            await this.#setDeviceInfo();
        }
        else {
            this.#reader.addEventListener(ValueChangedId, this.#handleNotifications);
        }

        this.#connected = true;
        this.#OnConnected();
    }

    /**
     * Disconnect from Secux Device
     */
    async Disconnect() {
        this.#device.gatt!.disconnect();
        this.#reader = undefined;
        this.#writer = undefined;
        this.#connected = false;
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

        await this.#setDeviceInfo();

        return true;
    }

    get CustomerId() { return this.#customerId; }
    get DeviceName() { return this.#device.name; }
    get DeviceType() { return this.#type ?? ''; }
    get DeviceId() { return this.#deviceId; }
    get Model() { return this.#model; }
    get MCU() { return this.#mcuVersion; }
    get SE() { return this.#seVersion; }


    #handleNotifications = (event: Event) => {
        //@ts-ignore
        const value = event.target?.value;
        if (value.buffer) this.ReceiveData(Buffer.from(value.buffer));
    }

    #handlePairing = (event: Event) => {
        //@ts-ignore
        const value = event.target?.value;
        if (value.buffer) {
            this.#receivedData = Buffer.from(value.buffer);
        }
        else {
            this.#receivedData = undefined;
        }
    }

    async #checkPairing() {
        const timeout = 120000;
        const interval = 1000;

        const echoTest = async () => {
            const payload = Buffer.from([0x70, 0x61, 0x69, 0x72, 0x69, 0x6e, 0x67]);
            const data = Buffer.from([0x80 + 2 + payload.length, 0xf8, 0x08, ...payload]);
            await this.Write(data);

            while (!this.#receivedData) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            data[1] = 0;
            if (data.equals(this.#receivedData.slice(0, data.length))) return true;

            return false;
        };

        for (let i = 0; i < timeout / interval; i++) {
            // re-connect
            if (!this.#reader || !this.#writer) {
                const server = await this.#device.gatt!.connect();
                if (!server) { throw Error("Cannot connect to device: BluetoothDevice.gatt is undefined"); }

                const info = Devices[DeviceType.nifty];
                const service = await server.getPrimaryService(info.PRIMARY);
                this.#reader = await service.getCharacteristic(info.TX);
                this.#writer = await service.getCharacteristic(info.RX);

                await this.#reader.startNotifications();
                this.#reader.addEventListener(ValueChangedId, this.#handlePairing);
            }

            try {
                const rsp: any = await Promise.race([
                    echoTest(),
                    new Promise((resolve) => setTimeout(resolve, interval))
                ]);

                if (rsp) return;
            } catch (e) { /* still at pairing state */ }
        }

        throw Error("bluetooth pairing error");
    }

    #identify(services: Array<BluetoothRemoteGATTService>) {
        for (const uuid of Object.values(Devices)) {
            const service = services.find(x => x.uuid === uuid.PRIMARY);
            if (!!service) {
                return { service, uuid };
            }
        }

        throw Error("Cannot find related GATTService");
    }

    async #setDeviceInfo() {
        const data = SecuxDevice.prepareGetVersion();
        const rsp = await this.Exchange(getBuffer(data));
        const { mcuFwVersion, seFwVersion, model, deviceId, customerId } = SecuxDevice.resolveVersion(rsp);
        this.#mcuVersion = mcuFwVersion;
        this.#seVersion = seFwVersion;
        if (model) this.#model = model;
        if (deviceId) this.#deviceId = deviceId;
        if (customerId) {
            this.#customerId = customerId;
        }
        else {
            // backward compatible
            //@ts-ignore
            this.#customerId = await this.getCustomerId();
        }

        if (["C20"].includes(this.#model)) {
            this.#type = DeviceType.shield;
            ITransport.deviceType = DeviceType.shield;
        }

        ITransport.mcuVersion = mcuFwVersion;
        ITransport.seVersion = seFwVersion;
    }
}
