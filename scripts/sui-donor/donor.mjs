#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { normalizeStructTag, isValidSuiAddress } from '@mysten/sui/utils';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(scriptDir, '.env'));

const SUI = '0x2::sui::SUI';
const help = `
Sui donor wallet (amounts are integer base units)

  npm run sui:donor -- address
  npm run sui:donor -- balance --type 0x2::sui::SUI
  npm run sui:donor -- send-object  --to 0x... --type COIN_TYPE --amount 1000000
  npm run sui:donor -- send-address --to 0x... --type COIN_TYPE --amount 1000000

send-object  creates Coin<T> and transfers that object to the recipient.
send-address creates Balance<T> and calls 0x2::balance::send_funds.
`;

function loadEnv(filename) {
    if (!fs.existsSync(filename)) return;
    const mode = fs.statSync(filename).mode & 0o777;
    if ((mode & 0o077) !== 0) {
        console.warn(`Warning: ${filename} is readable by other users; consider chmod 600.`);
    }
    for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || match[1].startsWith('#')) continue;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
}

function parseArguments(argv) {
    const command = argv[0] ?? 'help';
    const options = {};
    for (let i = 1; i < argv.length; i += 1) {
        const key = argv[i];
        if (!key.startsWith('--') || i + 1 >= argv.length) {
            throw new Error(`Invalid argument: ${key}`);
        }
        options[key.slice(2)] = argv[++i];
    }
    return { command, options };
}

function donor() {
    const mnemonic = (process.env.SUI_DONOR_MNEMONIC ?? '').trim().replace(/\s+/g, ' ');
    if (mnemonic.split(' ').filter(Boolean).length !== 24) {
        throw new Error('SUI_DONOR_MNEMONIC must contain exactly 24 words. Copy .env.example to .env first.');
    }
    const derivationPath = process.env.SUI_DONOR_DERIVATION_PATH ?? "m/44'/784'/0'/0'/0'";
    const keypair = Ed25519Keypair.deriveKeypair(mnemonic, derivationPath);
    return { keypair, address: keypair.toSuiAddress(), derivationPath };
}

function client() {
    return new SuiGrpcClient({
        network: process.env.SUI_DONOR_NETWORK ?? 'mainnet',
        baseUrl: process.env.SUI_DONOR_GRPC_URL ?? 'https://grpc.mainnet.sui.io:443',
    });
}

function coinType(value) {
    try {
        return normalizeStructTag(value || SUI);
    } catch {
        throw new Error(`Invalid coin type: ${value}`);
    }
}

function amount(value) {
    if (!/^[1-9][0-9]*$/.test(value ?? '')) {
        throw new Error('--amount must be a positive integer in base units');
    }
    return BigInt(value);
}

function recipient(value) {
    if (!value || !isValidSuiAddress(value)) throw new Error(`Invalid --to address: ${value}`);
    return value;
}

function json(value) {
    return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
}

async function showBalance(options) {
    const { address } = donor();
    const type = coinType(options.type);
    const api = client();
    const [{ balance }, coins] = await Promise.all([
        api.getBalance({ owner: address, coinType: type }),
        api.listCoins({ owner: address, coinType: type }),
    ]);
    console.log(json({
        address,
        coinType: type,
        totalBalance: balance.balance,
        coinObjectBalance: balance.coinBalance,
        addressBalance: balance.addressBalance,
        coinObjectCount: coins.objects.length,
        hasMoreCoinObjects: coins.hasNextPage,
    }));
}

async function send(command, options) {
    const { keypair, address } = donor();
    const type = coinType(options.type);
    const value = amount(options.amount);
    const to = recipient(options.to);
    const api = client();
    const { balance } = await api.getBalance({ owner: address, coinType: type });
    if (BigInt(balance.balance) < value) {
        throw new Error(`Insufficient ${type}: need ${value}, total balance is ${balance.balance}`);
    }

    const tx = new Transaction();
    tx.setSender(address);
    if (command === 'send-object') {
        const coin = tx.coin({ type, balance: value });
        tx.transferObjects([coin], to);
    } else {
        const funds = tx.balance({ type, balance: value });
        tx.moveCall({
            target: '0x2::balance::send_funds',
            typeArguments: [type],
            arguments: [funds, tx.pure.address(to)],
        });
    }

    const result = await keypair.signAndExecuteTransaction({ transaction: tx, client: api });
    console.log(json(result));
}

async function main() {
    const { command, options } = parseArguments(process.argv.slice(2));
    if (command === 'help' || command === '--help' || command === '-h') {
        console.log(help.trim());
        return;
    }
    if (command === 'address') {
        const { address, derivationPath } = donor();
        console.log(json({ address, derivationPath, network: process.env.SUI_DONOR_NETWORK ?? 'mainnet' }));
        return;
    }
    if (command === 'balance') return showBalance(options);
    if (command === 'send-object' || command === 'send-address') return send(command, options);
    throw new Error(`Unknown command: ${command}\n\n${help}`);
}

main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
});
