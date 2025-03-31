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


import * as BufferLayout from "@solana/buffer-layout";
import { Base58String, HexString, ow_address, ow_programid, ow_publickey } from "./interface";
import { 
    createLayout, createWithSeedLayout, getAlloc, setComputeUnitLimitData, setComputeUnitLimitLayout, setComputeUnitPriceData, 
    setComputeUnitPriceLayout, transferLayout 
} from "./layout";
import { Instruction } from "./transaction";
import { createWithSeed, toPublickey } from "./utils";
import ow from "ow";
import { SecuxSOL } from "./app-sol";
import { BigIntToBuffer, owTool } from "@secux/utility";
import { Base58 } from "@secux/utility/lib/bs58";


const SYSVAR_CLOCK_PUBKEY: HexString = "06a7d51718c774c928566398691d5eb68b5eb8a39b4b6d5c73555b2100000000";
const SYSVAR_RENT_PUBKEY: HexString = "06a7d517192c5c51218cc94c3d4af17f58daee089ba1fd44e3dbd98a00000000";
const SYSVAR_STAKE_HISTORY_PUBKEY: HexString = "06a7d517193584d0feed9bb3431d13206be544281b57b8566cc5375ff4000000";
const STAKE_CONFIG_ID: HexString = "06a1d817a502050b680791e6ce6db88e1e5b7150f61fc6790a4eb4d100000000";


export class SystemInstruction {
    static readonly programId: HexString = '0'.repeat(64);

    static createAccount(params: { payer: Base58String, lamports: number, space: number, pubkey: string | Buffer }): Instruction {
        ow(params, ow.object.partialShape({
            payer: ow_address,
            lamports: ow.number.positive,
            space: ow.number.positive,
            pubkey: ow_publickey
        }));

        const data = encodeData(createLayout, {
            instruction: 0,
            lamports: params.lamports,
            space: params.space,
            programId: Buffer.from(SystemInstruction.programId, "hex")
        });

        const payer = toPublickey(params.payer);
        const newAccount = params.pubkey.toString("hex");
        if (payer === newAccount) throw Error(`ArgumentError: both payer and new account must be different`);

        const accounts = [
            { publickey: payer, isSigner: true, isWritable: true },
            { publickey: newAccount, isSigner: true, isWritable: true },
        ];

        return {
            programId: SystemInstruction.programId,
            accounts,
            data
        }
    }

    static transfer(params: { from: Base58String, to: Base58String, lamports: number }): Instruction {
        ow(params, ow.object.partialShape({
            from: ow_address,
            to: ow_address,
            lamports: ow.number.positive
        }));

        const data = encodeData(transferLayout, {
            instruction: 2,
            lamports: params.lamports
        });
        const accounts = [
            { publickey: toPublickey(params.from), isSigner: true, isWritable: true },
            { publickey: toPublickey(params.to), isSigner: false, isWritable: true }
        ];

        return {
            programId: SystemInstruction.programId,
            accounts,
            data
        }
    }

    static createAccountWithSeed(params: {
        payer: Base58String,
        from?: Base58String,
        seed: string,
        programId: Base58String,
        lamports: number,
        space?: number
    }): Instruction {
        ow(params, ow.object.partialShape({
            payer: ow_address,
            from: ow.any(ow.undefined, ow_address),
            seed: ow.string.nonEmpty,
            programId: ow_programid,
            lamports: ow.number.positive,
            space: ow.optional.number.positive
        }));

        const base = Base58.decode(params.from ?? params.payer);
        const programId = Base58.decode(params.programId);
        const newAccount = createWithSeed(base, params.seed, programId);

        const accounts = [
            { publickey: toPublickey(params.payer), isSigner: true, isWritable: true },
            { publickey: newAccount.toString("hex"), isSigner: false, isWritable: true },
        ];
        if (params.from && params.payer !== params.from) {
            accounts.push({ publickey: base.toString("hex"), isSigner: false, isWritable: true });
        }

        const data = encodeData(createWithSeedLayout, {
            instruction: 3,
            base,
            seed: params.seed,
            lamports: params.lamports,
            space: params.space ?? 200,
            programId
        });

        return {
            programId: SystemInstruction.programId,
            accounts,
            data
        }
    }
}

export class ComputeBudgetInstruction {
    static readonly programId: HexString = "0306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a40000000";

    static setComputeUnitLimit(params: setComputeUnitLimitData): Instruction {
        const data = encodeData(setComputeUnitLimitLayout, {
            instruction: 2,
            ...params
        });

        return {
            programId: ComputeBudgetInstruction.programId,
            accounts: [],
            data
        };
    }

    static setComputeUnitPrice(params: setComputeUnitPriceData): Instruction {
        const data = encodeData(setComputeUnitPriceLayout, {
            instruction: 3,
            ...params
        });

        return {
            programId: ComputeBudgetInstruction.programId,
            accounts: [],
            data
        };
    }
}

export class TokenInstruction {
    static readonly TOKEN_PROGRAM_ID: HexString = "06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9";
    static readonly ASSOCIATED_TOKEN_PROGRAM_ID: HexString = "8c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859";
    static readonly TOKEN2022_PROGRAM_ID: HexString = "06ddf6e1ee758fde18425dbce46ccddab61afc4d83b90d27febdf928d8a18bfc";

    static createAssociatedTokenAccount(params: { 
        payer: Base58String, 
        owner: Base58String, 
        mint: Base58String, 
        program?: HexString,
    }): Instruction {
        ow(params, ow.object.partialShape({
            payer: ow_address,
            owner: ow_address,
            mint: ow_address,
            program: ow.any(ow.undefined, owTool.hexString)
        }));

        const pk = toPublickey(params.owner);
        const associatedTokenAccount = SecuxSOL.addressConvert(pk, { mintAccount: params.mint });

        const accounts = [
            { publickey: toPublickey(params.payer), isSigner: true, isWritable: true },
            { publickey: toPublickey(associatedTokenAccount), isSigner: false, isWritable: true },
            { publickey: pk, isSigner: false, isWritable: false },
            { publickey: toPublickey(params.mint), isSigner: false, isWritable: false },
            { publickey: SystemInstruction.programId, isSigner: false, isWritable: false },
            { publickey: params.program ?? TokenInstruction.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { publickey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ];

        return {
            programId: TokenInstruction.ASSOCIATED_TOKEN_PROGRAM_ID,
            accounts,
            data: Buffer.alloc(0)
        }
    }

    static transfer(params: {
        from: Base58String,
        to: Base58String,
        owner: Base58String,
        amount: string | number,
        program?: HexString,
    }): Instruction {
        ow(params, ow.object.partialShape({
            from: ow_address,
            to: ow_address,
            owner: ow_address,
            amount: ow.any(owTool.numberString, ow.number.positive),
            program: ow.any(ow.undefined, owTool.hexString)
        }));

        const accounts = [
            { publickey: toPublickey(params.from), isSigner: false, isWritable: true },
            { publickey: toPublickey(params.to), isSigner: false, isWritable: true },
            { publickey: toPublickey(params.owner), isSigner: true, isWritable: true }
        ];

        const data = Buffer.concat([
            Buffer.from([0x03]),
            BigIntToBuffer(params.amount, 8)
        ]);

        return {
            programId: params.program ?? TokenInstruction.TOKEN_PROGRAM_ID,
            accounts,
            data
        }
    }

    static closeAccount(params: { account: Base58String, owner: Base58String, program?: HexString }): Instruction {
        ow(params, ow.object.partialShape({
            account: ow_address,
            owner: ow_address,
            program: ow.any(ow.undefined, owTool.hexString)
        }));

        const accounts = [
            { publickey: toPublickey(params.account), isSigner: false, isWritable: true },
            { publickey: toPublickey(params.owner), isSigner: false, isWritable: true },
            { publickey: toPublickey(params.owner), isSigner: true, isWritable: true }
        ];

        return {
            programId: params.program ?? TokenInstruction.TOKEN_PROGRAM_ID,
            accounts,
            data: Buffer.from([0x09])
        }
    }

    static transferChecked(params: {
        from: Base58String,
        to: Base58String,
        owner: Base58String,
        mint: Base58String,
        decimal: number,
        amount: string | number,
        program?: HexString,
    }): Instruction {
        ow(params, ow.object.partialShape({
            from: ow_address,
            to: ow_address,
            owner: ow_address,
            mint: ow_address,
            decimal: ow.number.uint8,
            amount: ow.any(owTool.numberString, ow.number.positive),
            program: ow.any(ow.undefined, owTool.hexString)
        }));

        const accounts = [
            { publickey: toPublickey(params.from), isSigner: false, isWritable: true },
            { publickey: toPublickey(params.mint), isSigner: false, isWritable: false },
            { publickey: toPublickey(params.to), isSigner: false, isWritable: true },
            { publickey: toPublickey(params.owner), isSigner: true, isWritable: true }
        ];

        const data = Buffer.concat([
            Buffer.from([0x0c]),
            BigIntToBuffer(params.amount, 8),
            Buffer.from([params.decimal])
        ]);

        return {
            programId: params.program ?? TokenInstruction.TOKEN_PROGRAM_ID,
            accounts,
            data
        }
    }
}

export class StakeInstruction {
    static readonly programId: HexString = "06a1d8179137542a983437bdfe2a7ab2557f535c8a78722b68a49dc000000000";

    static initialize(params: { owner: Base58String, stake: Base58String }): Instruction {
        ow(params, ow.object.partialShape({
            owner: ow_address,
            stake: ow_address
        }));

        const accounts = [
            { publickey: toPublickey(params.stake), isSigner: false, isWritable: true },
            { publickey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ];

        const pk = Base58.decode(params.owner);
        const data = Buffer.concat([
            Buffer.from([0x00, 0x00, 0x00, 0x00]),  // instruction
            pk, pk,  // authorized: (staker, withdrawer)
            Buffer.from([
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // unixTimestamp
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // epoch
            ]),
            pk
        ]);

        return {
            programId: StakeInstruction.programId,
            accounts,
            data
        }
    }

    static delegate(params: { owner: Base58String, stake: Base58String, vote: Base58String }): Instruction {
        ow(params, ow.object.partialShape({
            owner: ow_address,
            stake: ow_address,
            vote: ow_address
        }));

        const accounts = [
            { publickey: toPublickey(params.stake), isSigner: false, isWritable: true },
            { publickey: toPublickey(params.vote), isSigner: false, isWritable: false },
            { publickey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { publickey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { publickey: STAKE_CONFIG_ID, isSigner: false, isWritable: false },
            { publickey: toPublickey(params.owner), isSigner: true, isWritable: true }
        ];

        return {
            programId: StakeInstruction.programId,
            accounts,
            data: Buffer.from([0x02, 0x00, 0x00, 0x00])
        }
    }

    static withdraw(params: { owner: Base58String, stake: Base58String, lamports: number }): Instruction {
        ow(params, ow.object.partialShape({
            owner: ow_address,
            stake: ow_address,
            lamports: ow.number.positive
        }));

        const accounts = [
            { publickey: toPublickey(params.stake), isSigner: false, isWritable: true },
            { publickey: toPublickey(params.owner), isSigner: false, isWritable: true },
            { publickey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { publickey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { publickey: toPublickey(params.owner), isSigner: true, isWritable: true }
        ];

        const data = Buffer.concat([
            Buffer.from([0x04, 0x00, 0x00, 0x00]),
            BigIntToBuffer(params.lamports, 8)
        ]);

        return {
            programId: StakeInstruction.programId,
            accounts,
            data
        }
    }

    static deactivate(params: { owner: Base58String, stake: Base58String }): Instruction {
        ow(params, ow.object.partialShape({
            owner: ow_address,
            stake: ow_address
        }));

        const accounts = [
            { publickey: toPublickey(params.stake), isSigner: false, isWritable: true },
            { publickey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { publickey: toPublickey(params.owner), isSigner: true, isWritable: true }
        ];

        return {
            programId: StakeInstruction.programId,
            accounts,
            data: Buffer.from([0x05, 0x00, 0x00, 0x00])
        }
    }
}


function encodeData(layout: BufferLayout.Structure<any>, fields: any) {
    const allocLength = layout.span >= 0 ? layout.span : getAlloc(layout, fields);
    const data = Buffer.alloc(allocLength);
    layout.encode(fields, data);

    return data;
}
