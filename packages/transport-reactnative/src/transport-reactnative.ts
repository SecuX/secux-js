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


require("./shim.js");
import {
    Device, BleError, Characteristic, BleManager, State, ScanCallbackType, ScanMode, Service, Subscription
} from "react-native-ble-plx";
import { ITransport } from "@secux/transport";
import { DeviceType } from "@secux/transport/lib/interface";
import { getBuffer, StatusCode, TransportStatusError } from "@secux/utility/lib/communication";
import { SecuxDevice } from "@secux/protocol-device";
import { Devices } from "./interface";
export { SecuxReactNativeBLE, DeviceCallback };


const callback = () => { };


/**
 * BLE transport module on react native for SecuX device
 */
class SecuxReactNativeBLE extends ITransport {
    static #bleManager: BleManager;
    static #scanning: boolean;

    #device?: Device;
    #mcuVersion: string = '';
    #seVersion: string = '';
    #model: string = '';
    #deviceId: string = '';
    #customerId: string = '';
    #type?: DeviceType;
    #reader?: Characteristic;
    #writer?: Characteristic;
    #OnConnected: Function;
    #OnDisconnected: DeviceCallback;
    #disconnectEvent?: Subscription;


    constructor(device: Device, OnConnected: Function = callback, OnDisconnected: DeviceCallback = callback) {
        super();

        this.#device = device;
        this.#OnConnected = OnConnected;
        this.#OnDisconnected = OnDisconnected;
    }

    /**
     * Create instance of SecuxReactNative
     * @param {string} deviceId device UUID/MAC_ADDRESS for bluetooth connection
     * @param {Function} OnConnected 
     * @param {DeviceCallback} OnDisconnected
     * @param {number} timeout bluetooth connection timeout (unit: ms) (default: 10000)
     * @returns {SecuxReactNativeBLE}
     */
    static async Create(deviceId: string, OnConnected: Function = callback, OnDisconnected: DeviceCallback = callback, timeout: number = 10000): Promise<SecuxReactNativeBLE> {
        await bleEnabled();

        const device = await this.bleManager.connectToDevice(deviceId, { timeout, autoConnect: true });
        return new SecuxReactNativeBLE(device, OnConnected, OnDisconnected);
    }

    /**
     * Connect to Secux Device by bluetooth on mobile
     */
    async Connect() {
        if (await this.#device!.isConnected()) {
            this.#OnConnected();
        }
        else {
            throw Error("Device unavailable");
        }

        this.#disconnectEvent = this.#device!.onDisconnected((err: BleError | null, device: Device) => {
            if (!err) {
                this.#OnDisconnected(this.#device!);
            } else {
                throw err;
            }
        });


        const uuid = await this.#setupGattService();
        this.#type = uuid.TYPE;
        this.packetSize = uuid.PACKET;
        this.version = uuid.PROTOCOL;

        console.log(`device name: ${this.#device!.name}`);
        console.log(`device type: ${uuid.TYPE}`);

        ITransport.deviceType = uuid.TYPE;

        if (this.#type === DeviceType.nifty) {
            await this.#checkPairing();
            await this.#setDeviceInfo();
        }
    }

    /**
     * Disconnect from Secux Device
     */
    async Disconnect() {
        if (await this.#device!.isConnected()) {
            await this.#device!.cancelConnection();
        }
    }

    /**
     * Write data to SecuX device
     * @param {Buffer} data
     */
    async Write(data: Buffer) {
        await this.#writer!.writeWithResponse(data.toString("base64"));
    }

    /**
     * OTP for Secux Device
     * @param {string} otp otp code
     * @returns {boolean} True if OTP is authenticated
     */
    async SendOTP(otp: string): Promise<boolean> {
        const recv = await this.Exchange(Buffer.from(otp));

        const status = getStatus(recv);
        if (status !== StatusCode.SUCCESS) {
            throw new TransportStatusError(status);
        }

        await this.#setDeviceInfo();

        return true;
    }

    Destory() {
        this.#disconnectEvent!.remove();
        this.#device!.isConnected()
            .then(connected => {
                if (connected) this.#device!.cancelConnection();
                this.#device = undefined;
            });
    }

    get DeviceName() { return this.#device!.name; }
    get DeviceType() { return this.#type ?? ''; }
    get Model() { return this.#model; }
    get DeviceId() { return this.#deviceId; }
    get CustomerId() { return this.#customerId; }
    get MCU() { return this.#mcuVersion; }
    get SE() { return this.#seVersion; }

    /**
     * Start to scan SecuX devices for pairing, remember to call StopScan()
     * @param {DeviceCallback} discovered will be called when a SecuX device is discovered
     */
    static async StartScan(discovered: DeviceCallback, vanished?: DeviceCallback, deviceTimeout: number = 2000, devices?: Array<DeviceType>) {
        if (this.#scanning) throw Error("Already scanning.");

        await bleEnabled();

        this.#scanning = true;

        const discover: Map<string, { device: Device, timer: NodeJS.Timeout }> = new Map();
        const subscription = this.bleManager.onStateChange((state) => {
            if (state === State.PoweredOn) {
                const uuids = Devices
                    .filter(x => (devices ?? [DeviceType.crypto]).includes(x.TYPE))
                    .map(x => x.SERVICE);

                this.bleManager.startDeviceScan(
                    uuids,
                    { allowDuplicates: true, scanMode: ScanMode.LowLatency, callbackType: ScanCallbackType.AllMatches },
                    (error, device) => {
                        if (!device || !device.name) return;
                        if (error) throw error;

                        const finded = discover.get(device.id);
                        if (finded) {
                            if (vanished) clearTimeout(finded.timer);
                        }
                        else {
                            discovered(device);
                        }

                        discover.set(device.id, {
                            device,
                            //@ts-ignore
                            timer: (!vanished) ? undefined :
                                setTimeout(() => {
                                    discover.delete(device.id);
                                    vanished(device);
                                }, deviceTimeout)
                        });
                    }
                );

                subscription.remove();
            }
        }, true);
    }

    /**
     * Stop to scan SecuX devices
     */
    static StopScan() {
        this.#scanning = false;
        this.bleManager.stopDeviceScan();
    }

    static get bleManager(): BleManager {
        if (!this.#bleManager) this.#bleManager = new BleManager();

        return this.#bleManager;
    }

    async #setupGattService() {
        await this.#device!.discoverAllServicesAndCharacteristics();
        const { service, uuid } = findDeviceType(await this.#device!.services());
        const characteristics = await service.characteristics();
        this.#reader = characteristics.find(c => c.uuid === uuid.TX);
        if (!this.#reader) throw Error("Cannot find NUS_TX_CHARACTERISTIC_UUID");
        this.#writer = characteristics.find(c => c.uuid === uuid.RX);
        if (!this.#writer) throw Error("Cannot find NUS_RX_CHARACTERISTIC_UUID");

        this.#reader.monitor((error, c) => {
            if (error) {
                console.log('error in notify', error);
            }
            else {
                let value = c?.value;
                if (!value) return;

                const buf = Buffer.from(value, "base64");
                this.ReceiveData(buf);
            }
        });

        return uuid;
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

    async #checkPairing() {
        const timeout = 120000;
        const interval = 5000;

        const payload = Buffer.from([0x70, 0x61, 0x69, 0x72, 0x69, 0x6e, 0x67]);
        const echoTest = async () => {
            const data = Buffer.from([0x80 + 2 + payload.length, 0xf8, 0x08, ...payload]);
            await this.Write(data);

            let rsp = await this.Read();
            while (!rsp) {
                rsp = await this.Read();
                await new Promise(resolve => setTimeout(resolve, 1));
            }

            return rsp.slice(2);
        };

        for (let i = 0; i < timeout / interval; i++) {
            // re-connect
            if (!await this.#device!.isConnected()) {
                await this.#device!.connect();
                await this.#setupGattService();
            }

            try {
                const rsp: any = await Promise.race([
                    echoTest(),
                    new Promise((resolve) => setTimeout(resolve, interval))
                ]);

                if (rsp?.equals(payload)) return;
            } catch (e) { console.log(e); /* still at pairing state */ }
        }

        throw Error("bluetooth pairing error");
    }
}

type DeviceCallback = (device: Device) => void;

function getStatus(data: Buffer): number {
    const dataLength = data.readUInt16LE(0);
    const status = data.readUInt16BE(2 + dataLength);

    return status;
}

async function bleEnabled() {
    let retry = 0;
    while (await SecuxReactNativeBLE.bleManager.state() !== State.PoweredOn) {
        if (retry++ > 10) throw Error("Please turn on bluetooth on your mobile phone.");

        await new Promise(res => setTimeout(res, 1));
    }
}

function findDeviceType(services: Array<Service>) {
    for (const uuid of Devices) {
        const service = services.find(x => x.uuid === uuid.PRIMARY);
        if (!!service) {
            return { service, uuid };
        }
    }

    throw Error("Cannot find related primary gatt service.");
}