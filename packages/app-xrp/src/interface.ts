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
import { owTool } from "@secux/utility";
import { validatePayment } from "./xrpl/models/transactions/payment";
import { validateOfferCreate } from "./xrpl/models/transactions/offerCreate";
import { validatePaymentChannelCreate } from "./xrpl/models/transactions/paymentChannelCreate";
import { validatePaymentChannelClaim } from "./xrpl/models/transactions/paymentChannelClaim";
import { validatePaymentChannelFund } from "./xrpl/models/transactions/paymentChannelFund";
import { validateOfferCancel } from "./xrpl/models/transactions/offerCancel";
import { validateEscrowCreate } from "./xrpl/models/transactions/escrowCreate";
import { validateEscrowCancel } from "./xrpl/models/transactions/escrowCancel";
import { validateEscrowFinish } from "./xrpl/models/transactions/escrowFinish";
import { validateAccountSet } from "./xrpl/models/transactions/accountSet";
import { validateAccountDelete } from "./xrpl/models/transactions/accountDelete";
import { validateTrustSet } from "./xrpl/models/transactions/trustSet";
export const ow_address = ow.string.matches(/^r[0-9A-Za-z]+$/);


const ow_tag = ow.number.lessThanOrEqual(Math.pow(2, 32) - 1);

export interface baseObject {
    TransactionType:
    "AccountSet" | "AccountDelete" |
    "EscrowCreate" | "EscrowCancel" | "EscrowFinish" |
    "Payment" | "PaymentChannelClaim" | "PaymentChannelCreate" | "PaymentChannelFund" |
    "OfferCreate" | "OfferCancel" | "TrustSet",
    Account?: string,
    Sequence: number,
    Fee: string | number,
    LastLedgerSequence: number,
    SigningPubKey: string | Buffer,
    Destination?: string,
    Amount?: string | number,
    SourceTag?: number,
    DestinationTag?: number,
}

export const validator: { [type: string]: (arg: any) => void } = {
    AccountSet: validateAccountSet,
    AccountDelete: validateAccountDelete,
    EscrowCreate: validateEscrowCreate,
    EscrowCancel: validateEscrowCancel,
    EscrowFinish: validateEscrowFinish,
    Payment: validatePayment,
    PaymentChannelClaim: validatePaymentChannelClaim,
    PaymentChannelCreate: validatePaymentChannelCreate,
    PaymentChannelFund: validatePaymentChannelFund,
    OfferCreate: validateOfferCreate,
    OfferCancel: validateOfferCancel,
    TrustSet: validateTrustSet,
}

export const TransactionTypes = Object.keys(validator);

export const ow_baseObject = ow.object.partialShape({
    Account: ow.any(ow.undefined, ow_address),
    TransactionType: ow.string.oneOf(TransactionTypes),
    Sequence: ow.number.not.negative,
    Fee: ow.any(owTool.numberString, ow.number.uint16),
    LastLedgerSequence: ow.number.not.negative,
    SigningPubKey: ow.any(owTool.hexString, ow.buffer),
    Destination: ow.any(ow.undefined, ow_address),
    Amount: ow.any(ow.undefined, owTool.numberString, ow.number.uint32),
    SourceTag: ow.any(ow.undefined, ow_tag),
    DestinationTag: ow.any(ow.undefined, ow_tag)
});
