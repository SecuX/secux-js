# Sui donor wallet

This local CLI derives one Ed25519 Sui account from a 24-word mnemonic and sends
SUI or any Sui token using the official `@mysten/sui` gRPC client.

## Setup

```sh
cp scripts/sui-donor/.env.example scripts/sui-donor/.env
chmod 600 scripts/sui-donor/.env
```

Replace `SUI_DONOR_MNEMONIC` with the 24 words. The `.env` file is ignored by
git and the CLI never prints the mnemonic or private key.

Get the donor address, then fund it with SUI and the token you want to test:

```sh
npm run sui:donor -- address
npm run sui:donor -- balance --type 0x2::sui::SUI
npm run sui:donor -- balance --type 0xPACKAGE::module::TOKEN
```

All amounts are raw integer base units (MIST for SUI), not display decimals.

## Send a Coin object

```sh
npm run sui:donor -- send-object \
  --to 0xRECIPIENT \
  --type 0x2::sui::SUI \
  --amount 1000000000
```

This uses `tx.coin(...)` and `tx.transferObjects(...)`. Replace `--type` with a
token's full struct tag to send that token as `Coin<T>`.

## Send to Address Balance

```sh
npm run sui:donor -- send-address \
  --to 0xRECIPIENT \
  --type 0xPACKAGE::module::TOKEN \
  --amount 1000000
```

This uses `tx.balance(...)` and the framework function
`0x2::balance::send_funds`. It does not call an arbitrary application contract.

Both transaction helpers may resolve funds from the donor's available object
and address balances. The *recipient representation* is what these two commands
control: `send-object` delivers a `Coin<T>` object, while `send-address` credits
the recipient's address balance.
