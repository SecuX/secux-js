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


export const Devices = [
    {
        TYPE: DeviceType.crypto,
        SERVICE: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        PRIMARY: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        RX: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
        TX: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
        PROTOCOL: ITransport.PROTOCOLv1,
        PACKET: 64,
    },
    {
        TYPE: DeviceType.nifty,
        SERVICE: "0000180a-0000-1000-8000-00805f9b34fb",
        PRIMARY: "7a200001-a171-69b8-8245-c41dd47bd699",
        RX: "7a200002-a171-69b8-8245-c41dd47bd699",
        TX: "7a200003-a171-69b8-8245-c41dd47bd699",
        PROTOCOL: ITransport.PROTOCOLv2,
        PACKET: 112,
    }
];
