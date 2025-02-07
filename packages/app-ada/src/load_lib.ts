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


let cardano: any = undefined;

(async () => {
    cardano = await import("@emurgo/cardano-serialization-lib-asmjs");
    cardano.__fee_a = 44;
    cardano.__fee_b = 155381;

    cardano.__config = cardano.TransactionBuilderConfigBuilder.new()
        .fee_algo(cardano.LinearFee.new(cardano.BigNum.from_str(cardano.__fee_a.toString(10)), cardano.BigNum.from_str(cardano.__fee_b.toString(10))))
        .pool_deposit(cardano.BigNum.from_str('500000000'))
        .key_deposit(cardano.BigNum.from_str('2000000'))
        .max_value_size(5000)
        .max_tx_size(16384)
        .coins_per_utxo_byte(cardano.BigNum.from_str('4310'))
        .build();

    cardano.__byronConfig = cardano.TransactionBuilderConfigBuilder.new()
        .fee_algo(cardano.LinearFee.new(cardano.BigNum.from_str('67'), cardano.BigNum.from_str('155381')))
        .pool_deposit(cardano.BigNum.from_str('500000000'))
        .key_deposit(cardano.BigNum.from_str('2000000'))
        .max_value_size(5000)
        .max_tx_size(16384)
        .coins_per_utxo_byte(cardano.BigNum.from_str('4310'))
        .build();
        
    cardano = Object.freeze(cardano);
})();

export { cardano };