/*!
Copyright 2023 SecuX Technology Inc
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
import { ITransportNordic } from "./interface";
import { DeviceType } from "@secux/transport/lib/interface";
import { Platform } from "react-native";
import {
    BleManager, Device, BleError, Characteristic, State, ScanCallbackType, ScanMode
} from "react-native-ble-plx";

type DeviceCallback = (device: Device) => void;

const SERVICE_UUID = "0000fe59-0000-1000-8000-00805f9b34fb";
const CONTROL_UUID = "8ec90001-f315-4f60-9fb8-838830daea50";
const PACKET_UUID = "8ec90002-f315-4f60-9fb8-838830daea50";

export class SecuxReactNativeNordic extends ITransport implements ITransportNordic {
    static #bleManager: BleManager = new BleManager();
    #device: Device;
    #control?: Characteristic;
    #packet?: Characteristic;

    constructor(device: Device) {
        super();
        this.packetSize = Platform.OS === "android" ? device.mtu : 187;
        this.#device = device;
    }

    static async Connect(timeout: number = 10000) {
        let firstDevice: Device | undefined;
        SecuxReactNativeNordic.#StartScan((device) => {
            firstDevice = device;
            SecuxReactNativeNordic.#StopScan();
        });

        const timestamp = Date.now();
        await new Promise((resolve, rejcet) =>
            setInterval(() => {
                if (Date.now() - timestamp > timeout) rejcet("cannot find device");
                if (firstDevice) resolve("connected");
            }, 100)
        );

        const connectedDevice = await this.#bleManager.connectToDevice(
            firstDevice!.id,
            {
                timeout,
                autoConnect: true,
                requestMTU: 517,
            }
        );

        const transport = new SecuxReactNativeNordic(connectedDevice);
        await transport.Connect();

        return transport;
    }

    static #StartScan(discovered: DeviceCallback, vanished?: DeviceCallback | undefined, deviceTimeout?: number | undefined, devices?: DeviceType[] | undefined) {
        const discover: Map<string, { device: Device, timer: NodeJS.Timeout }> = new Map();
        const subscription = this.#bleManager.onStateChange((state) => {
            if (state === State.PoweredOn) {
                this.#bleManager.startDeviceScan(
                    [SERVICE_UUID],
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

    static #StopScan() {
        this.#bleManager.stopDeviceScan();
    }

    async Connect(): Promise<void> {
        this.#device!.onDisconnected((err: BleError | null, device: Device) => {
            if (!err) {
                this.#device.cancelConnection();
                this.#control = undefined;
                this.#packet = undefined;
            }
            else {
                throw err;
            }
        });

        await this.#device!.discoverAllServicesAndCharacteristics();
        const serviceList = await this.#device!.services();
        const service = serviceList.find(x => x.uuid === SERVICE_UUID)!;
        const characteristics = await service.characteristics();
        this.#control = characteristics.find(c => c.uuid === CONTROL_UUID);
        if (!this.#control) throw Error("Cannot find NORDIC_CONTROL_CHARACTERISTIC_UUID");
        this.#packet = characteristics.find(c => c.uuid === PACKET_UUID);
        if (!this.#packet) throw Error("Cannot find NORDIC_PACKET_CHARACTERISTIC_UUID");

        this.#control.monitor((error, c) => {
            if (error) {
                console.log('error in notify', error);
            }
            else {
                let value = c?.value;
                if (!value) return;

                const buf = Buffer.from(value, "base64");
                console.log(`received: ${buf.toString("hex")}`)
                this.ReceiveData(buf);
            }
        });
    }

    async Write(data: Buffer) {
        await this.#control!.writeWithResponse(data.toString("base64"));
    }

    async WritePacket(data: Buffer) {
        await this.#packet!.writeWithoutResponse(data.toString("base64"));
    }
}
