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


import { Interface } from "@ethersproject/abi";
import ow from "ow";
import { prepareSign } from "./app-eth";
import { baseData, ow_address, ow_baseData, ow_hexString32, PrefixedHexString } from "./interface";
import { getBuilder } from "./transaction";
import { TransactionType } from "@secux/protocol-transaction/lib/interface";


export class ERC20 {
    /**
     * ERC20 Function Call
     * - function transfer(address _to, uint256 _value) public returns (bool success)
     * @param {string} path BIP32
     * @param {baseData} content 
     * @param {transferData} args
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {communicationData} prepared.rawTx
     */
    static prepareTransfer(path: string, content: baseData, args: transferData) {
        ow(content, ow_baseData);
        ow(args, ow_transferData);


        const data = erc20_def.encodeFunctionData("transfer", [args.toAddress, args.amount]);
        const builder = getBuilder({
            ...content,
            data
        });

        return prepareSign(path, builder, TransactionType.TOKEN);
    }

    /**
     * ERC20 Function Call
     * - function transferFrom(address _from, address _to, uint256 _value) public returns (bool success)
     * @param {string} path BIP32
     * @param {baseData} content
     * @param {transferFromData} args
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {communicationData} prepared.rawTx
     */
    static prepareTransferFrom(path: string, content: baseData, args: transferFromData) {
        ow(content, ow_baseData);
        ow(args, ow_transferFromData);


        const data = erc20_def.encodeFunctionData("transferFrom", [args.fromAddress, args.toAddress, args.amount]);
        const builder = getBuilder({
            ...content,
            data
        });

        return prepareSign(path, builder, TransactionType.TOKEN);
    }

    /**
     * ERC20 Methods
     * - function approve(address _spender, uint256 _value) public returns (bool success)
     * @param {string} path BIP32
     * @param {baseData} content
     * @param {transferData} args
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {communicationData} prepared.rawTx
     */
    static prepareApprove(path: string, content: baseData, args: transferData) {
        ow(content, ow_baseData);
        ow(args, ow_transferData);
        

        const data = erc20_def.encodeFunctionData("approve", [args.toAddress, args.amount]);
        const builder = getBuilder({
            ...content,
            data
        });

        return prepareSign(path, builder, TransactionType.TOKEN);
    }
}


export const erc20_def = new Interface([
    "function name() public view returns (string)",
    "function symbol() public view returns (string)",
    "function decimals() public view returns (uint8)",
    "function totalSupply() public view returns (uint256)",
    "function balanceOf(address _owner) public view returns (uint256 balance)",
    "function transfer(address _to, uint256 _value) public returns (bool success)",
    "function transferFrom(address _from, address _to, uint256 _value) public returns (bool success)",
    "function approve(address _spender, uint256 _value) public returns (bool success)",
    "function allowance(address _owner, address _spender) public view returns (uint256 remaining)",

    "event Transfer(address indexed _from, address indexed _to, uint256 _value)",
    "event Approval(address indexed _owner, address indexed _spender, uint256 _value)"
]);

export interface transferData {
    toAddress: string,
    amount: number | PrefixedHexString
}

const ow_transferData = ow.object.exactShape({
    toAddress: ow_address,
    amount: ow.any(ow.number.positive, ow_hexString32)
});

export interface transferFromData extends transferData {
    fromAddress: string
}

const ow_transferFromData = ow.object.exactShape({
    fromAddress: ow_address,
    toAddress: ow_address,
    amount: ow.any(ow.number.positive, ow_hexString32)
});