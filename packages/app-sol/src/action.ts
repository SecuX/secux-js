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


import { Base58 } from "@secux/utility/lib/bs58";
import { SecuxSOL } from "./app-sol";
import { TokenInstruction, StakeInstruction } from "./instruction";
import { Base58String, BuiltinInstruction, HexString, InstructionType, ow_address } from "./interface";
import ow from "ow";
import { Logger } from "@secux/utility";
const logger = Logger?.child({ id: "action" });


/**
 * SOL high level action of aggregated instruction
 */
export class Action {
    static transferToken(params: {
        from?: Base58String,
        to: Base58String,
        owner: Base58String,
        amount: string | number,
        mint: Base58String,
        decimal: number,
        createAccount?: boolean,
        program?: HexString,
    }): Array<BuiltinInstruction> {
        ow(params, ow.object.partialShape({
            to: ow_address,
            owner: ow_address,
            mint: ow_address,
            createAccount: ow.optional.boolean
        }));

        const publickey = Base58.decode(params.owner);
        const from = params.from ?? 
            SecuxSOL.addressConvert(publickey, {
                mintAccount: params.mint,
                program: params.program ?? TokenInstruction.TOKEN_PROGRAM_ID,
            });
        const instructions: Array<BuiltinInstruction> = [
            {
                type: InstructionType.TransferTokenChecked,
                params: {
                    from,
                    to: params.to,
                    owner: params.owner,
                    amount: params.amount,
                    mint: params.mint,
                    decimal: params.decimal,
                    program: params.program,
                }
            },
        ];

        if (params.createAccount) {
            instructions.unshift(
                {
                    type: InstructionType.CreateAssociatedAccount,
                    params: {
                        payer: params.owner,
                        owner: params.to,
                        mint: params.mint,
                        program: params.program,
                    }
                }
            );

            const ata = SecuxSOL.addressConvert(Base58.decode(params.to), { mintAccount: params.mint });
            instructions[1].params.to = ata;
        }

        return instructions;
    }

    static stake(params: {
        owner: Base58String,
        stake: string | Base58String,
        vote: Base58String,
        lamports: number,
        space?: number
    }): Array<BuiltinInstruction> {
        ow(params, ow.object.partialShape({
            owner: ow_address,
            stake: ow.string.nonEmpty
        }));

        const instructions: Array<BuiltinInstruction> = [];

        let stake = params.stake;
        if (!isAccount(stake)) {
            logger?.warn(`treat value of stake "${stake}" as seed`);

            const seed = params.stake;
            const programId = Base58.encode(Buffer.from(StakeInstruction.programId, "hex"));

            // create stake account with seed
            stake = SecuxSOL.addressConvert(Base58.decode(params.owner), { seed, programId });

            instructions.push(
                {
                    type: InstructionType.CreateAccountWithSeed,
                    params: {
                        payer: params.owner,
                        seed,
                        programId,
                        lamports: params.lamports,
                        space: params.space
                    }
                },
                {
                    type: InstructionType.InitializeStake,
                    params: {
                        owner: params.owner,
                        stake
                    }
                }
            );
        }

        instructions.push(
            {
                type: InstructionType.Delegate,
                params: {
                    owner: params.owner,
                    stake,
                    vote: params.vote
                }
            }
        );

        return instructions;
    }

    static unstake(params: { owner: Base58String, stake: string | Base58String, lamports: number }): Array<BuiltinInstruction> {
        ow(params, ow.object.partialShape({
            owner: ow_address,
            stake: ow.string.nonEmpty
        }));
        
        let stake = params.stake;
        if (!isAccount(stake)) {
            logger?.warn(`treat value of stake "${stake}" as seed`);

            const programId = Base58.encode(Buffer.from(StakeInstruction.programId, "hex"));
            stake = SecuxSOL.addressConvert(Base58.decode(params.owner), { seed: stake, programId });
        }

        return [
            {
                type: InstructionType.Deactivate,
                params: {
                    owner: params.owner,
                    stake
                }
            },
            {
                type: InstructionType.Withdraw,
                params: {
                    owner: params.owner,
                    stake,
                    lamports: params.lamports
                }
            }
        ]
    }
}


function isAccount(str: string): boolean {
    try {
        ow(str, ow_address);
        return true;
    } catch (error) {}

    return false;
}