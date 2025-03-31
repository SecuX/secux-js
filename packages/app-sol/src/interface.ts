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


import ow from "ow";
import { ow_checkBufferLength, owTool } from "@secux/utility";
import { ComputeBudgetInstruction, StakeInstruction, SystemInstruction, TokenInstruction } from "./instruction";
import { ow_TransactionType, TransactionType } from "@secux/protocol-transaction/lib/interface";
import { communicationData, ow_communicationData } from "@secux/utility/lib/communication";


export const ow_address = owTool.base58String.minLength(43).maxLength(44);
export const ow_programid = ow.any(ow_address, ow.string.oneOf([
    "11111111111111111111111111111111"
]));
export const ow_publickey = ow.any(owTool.hexString.length(64), ow_checkBufferLength(32));
export const ow_path = ow.string.matches(/^m\/44'\/501'(\/\d+'){1,2}$/);

export type Base58String = string;
export type HexString = string;

export type ATAOption = {
    mintAccount: Base58String,
    program?: HexString,
};

export const ow_ATAOption = ow.object.exactShape({
    mintAccount: ow_address,
    program: ow.any(ow.undefined, owTool.hexString),
});

export type SeedOption = {
    seed: string,
    programId: Base58String
};

export const ow_SeedOption = ow.object.exactShape({
    seed: ow.string.nonEmpty,
    programId: ow_programid
});

export type Instruction = {
    programId: Base58String,
    keys: Array<{ pubkey: Base58String, isSigner: boolean, isWritable: boolean }>,
    data: communicationData
};

export const ow_instruction = ow.object.partialShape({
    programId: ow_programid,
    keys: ow.array.ofType(ow.object.partialShape({
        pubkey: owTool.base58String,
        isSigner: ow.boolean,
        isWritable: ow.boolean
    })),
    data: ow.any(ow.string.empty, ow_communicationData)
});

export type HexInstruction = {
    programId: HexString,
    accounts: Array<{ publickey: HexString, isSigner: boolean, isWritable: boolean }>,
    data: communicationData
};

export const ow_hexInstruction = ow.object.partialShape({
    programId: ow_publickey,
    accounts: ow.array.ofType(ow.object.partialShape({
        publickey: ow_publickey,
        isSigner: ow.boolean,
        isWritable: ow.boolean
    })),
    data: ow.any(ow.string.empty, ow_communicationData)
});

export enum InstructionType {
    SetUnitLimit = "setComputeUnitLimit",
    SetUnitPrice = "setComputeUnitPrice",

    CreateAccount = "createAccount",
    Transfer = "transfer",
    CreateAccountWithSeed = "createAccountWithSeed",

    CreateAssociatedAccount = "createAssociatedTokenAccount",
    TransferToken = "tokenTransfer",
    TransferTokenChecked = "tokenTransferChecked",
    CloseAccount = "closeAccount",

    InitializeStake = "initializeStake",
    Delegate = "delegate",
    Withdraw = "withdraw",
    Deactivate = "deactivate"
}

export type BuiltinInstruction = {
    type: InstructionType,
    params: any
};

export const ow_builtinInstruction = ow.object.partialShape({
    type: ow.string.oneOf(Object.values(InstructionType)),
});

export type Ownership = {
    path: string,
    account: Base58String
};
export type txDetail = {
    recentBlockhash: Base58String,
    instructions: Array<Instruction | BuiltinInstruction>,
    ownerships: Array<Ownership>,
    txType?: TransactionType
};

export type txOption = {
    feePayer?: Base58String,
    txType?: TransactionType,
};

export const ow_ownership = ow.object.partialShape({
    path: ow_path,
    account: ow_address
});
export const ow_txDetail = ow.object.partialShape({
    recentBlockhash: ow_address,
    instructions: ow.array.ofType(ow.any(ow_builtinInstruction, ow_instruction, ow_hexInstruction)).nonEmpty,
    ownerships: ow.array.ofType(ow_ownership).nonEmpty,
    txType: ow.any(ow.undefined, ow_TransactionType)
});

export const ow_txOption = ow.object.partialShape({
    feePayer: ow.any(ow.undefined, ow_address),
    txType: ow.any(ow.undefined, ow_TransactionType)
})

export const InstructionMap: { [type: string]: Function } = {}
InstructionMap[InstructionType.SetUnitLimit] = ComputeBudgetInstruction.setComputeUnitLimit;
InstructionMap[InstructionType.SetUnitPrice] = ComputeBudgetInstruction.setComputeUnitPrice;
InstructionMap[InstructionType.CreateAccount] = SystemInstruction.createAccount;
InstructionMap[InstructionType.Transfer] = SystemInstruction.transfer;
InstructionMap[InstructionType.CreateAssociatedAccount] = TokenInstruction.createAssociatedTokenAccount;
InstructionMap[InstructionType.TransferToken] = TokenInstruction.transfer;
InstructionMap[InstructionType.TransferTokenChecked] = TokenInstruction.transferChecked;
InstructionMap[InstructionType.CloseAccount] = TokenInstruction.closeAccount;
InstructionMap[InstructionType.CreateAccountWithSeed] = SystemInstruction.createAccountWithSeed;
InstructionMap[InstructionType.InitializeStake] = StakeInstruction.initialize;
InstructionMap[InstructionType.Delegate] = StakeInstruction.delegate;
InstructionMap[InstructionType.Withdraw] = StakeInstruction.withdraw;
InstructionMap[InstructionType.Deactivate] = StakeInstruction.deactivate;

Object.freeze(InstructionMap);