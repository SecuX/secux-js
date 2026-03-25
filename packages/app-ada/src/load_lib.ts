/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu
Copyright Chang Chia-Yu

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

import * as CSL from "@emurgo/cardano-serialization-lib-asmjs";

const lib = (CSL as any).Bip32PublicKey ? CSL : (CSL as any).default;
lib.__fee_a = 44;
lib.__fee_b = 155381;
lib.__fee_b_plus = 155881;

// 1. 直接引用 baseLib
export const cardano = lib;

// 2. 使用 defineProperty 定義一個「用到才執行」的屬性
Object.defineProperty(cardano, "__config", {
  get: function () {
    // 檢查是否已經初始化過，避免重複執行
    if (!this._cached_config) {
      console.log("正在初始化 __config...");
      this._cached_config = lib.TransactionBuilderConfigBuilder.new()
        .fee_algo(
          lib.LinearFee.new(
            lib.BigNum.from_str(lib.__fee_a.toString(10)),
            lib.BigNum.from_str(lib.__fee_b_plus.toString(10)),
          ),
        )
        .pool_deposit(lib.BigNum.from_str("500000000"))
        .key_deposit(lib.BigNum.from_str("2000000"))
        .max_value_size(5000)
        .max_tx_size(16384)
        .coins_per_utxo_byte(lib.BigNum.from_str("4310"))
        .build();
    }
    return this._cached_config;
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(cardano, "__byronConfig", {
  get: function () {
    // 檢查是否已經初始化過，避免重複執行
    if (!this._cached_byron_config) {
      console.log("正在初始化 __byronConfig...");
      this._cached_byron_config = lib.TransactionBuilderConfigBuilder.new()
        .fee_algo(
          lib.LinearFee.new(
            lib.BigNum.from_str("67"),
            lib.BigNum.from_str("155381"),
          ),
        )
        .pool_deposit(lib.BigNum.from_str("500000000"))
        .key_deposit(lib.BigNum.from_str("2000000"))
        .max_value_size(5000)
        .max_tx_size(16384)
        .coins_per_utxo_byte(lib.BigNum.from_str("4310"))
        .build();
    }
    return this._cached_byron_config;
  },
  configurable: true,
  enumerable: true,
});
