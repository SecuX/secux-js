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
const { Platform } = require("react-native");
import { Device, BleError, Characteristic, BleManager, State, ScanCallbackType, ScanMode, Service } from "react-native-ble-plx";
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

    #device: Device;
    #mcuVersion: string = '';
    #seVersion: string = '';
    #type?: DeviceType;
    #reader?: Characteristic;
    #writer?: Characteristic;
    #OnConnected: Function;
    #OnDisconnected: DeviceCallback;


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

        const connect = this.bleManager.connectToDevice(deviceId);
        const timer = new Promise(res => setTimeout(res, timeout)).then(() => undefined);
        const device = await Promise.race([connect, timer]);

        if (!device) throw Error("Please turn on bluetooth on your SecuX device.");

        return new SecuxReactNativeBLE(device, OnConnected, OnDisconnected);
    }

    /**
     * Connect to Secux Device by bluetooth on mobile
     */
    async Connect() {
        if (await this.#device.isConnected()) {
            this.#OnConnected();
        }
        else {
            throw "Device unavailable";
        }

        const handleDisconnect = (err: BleError | null, device: Device) => {
            console.log('in handle disconnect');
            if (!err) {
                onDisconnectedEvent.remove();
                this.#OnDisconnected(this.#device);
            } else {
                throw err;
            }
        }
        const onDisconnectedEvent = this.#device.onDisconnected(handleDisconnect);


        await this.#device.discoverAllServicesAndCharacteristics();
        const { service, uuid } = findDeviceType(await this.#device.services());
        const characteristics = await service.characteristics();
        this.#reader = characteristics.find(c => c.uuid === uuid.TX);
        if (!this.#reader) throw "Cannot find NUS_TX_CHARACTERISTIC_UUID";
        this.#writer = characteristics.find(c => c.uuid === uuid.RX);
        if (!this.#writer) throw "Cannot find NUS_RX_CHARACTERISTIC_UUID";

        this.#type = uuid.TYPE;
        this.packetSize = uuid.PACKET;
        this.version = uuid.PROTOCOL;

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

        ITransport.deviceType = uuid.TYPE;
        await this.#setFirmwareVersion();
    }

    /**
     * Disconnect from Secux Device
     */
    async Disconnect() {
        if (await this.#device.isConnected()) {
            await this.#device.cancelConnection();
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

        return true;
    }

    get DeviceName() { return this.#device.name; }
    get DeviceType() { return this.#type ?? ''; }
    get MCU() { return this.#mcuVersion; }
    get SE() { return this.#seVersion; }

    /**
     * Start to scan SecuX devices for pairing, remember to call StopScan()
     * @param {DeviceCallback} discovered will be called when a SecuX device is discovered
     */
    static async StartScan(discovered: DeviceCallback, vanished?: DeviceCallback, deviceTimeout: number = 2000, devices?: Array<DeviceType>) {
        if (this.#scanning) throw Error("Already scanning.");

        await bleEnabled();

        if (Platform.OS === "android") {
            const RNSettings = require("react-native-settings").default;


            const location = await RNSettings.getSetting(RNSettings.LOCATION_SETTING);
            if (location !== RNSettings.ENABLED) throw Error("Please turn on location service on your mobile phone.");
        }

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

                        let item;
                        if ((item = discover.get(device.id))) {
                            if (vanished) clearTimeout(item.timer);
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

    async #setFirmwareVersion() {
        const data = SecuxDevice.prepareGetVersion();
        const rsp = await this.Exchange(getBuffer(data));
        const { mcuFwVersion, seFwVersion } = SecuxDevice.resolveVersion(rsp);
        this.#mcuVersion = mcuFwVersion;
        this.#seVersion = seFwVersion;

        ITransport.mcuVersion = mcuFwVersion;
        ITransport.seVersion = seFwVersion;
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