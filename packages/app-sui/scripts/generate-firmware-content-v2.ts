import fs from "node:fs";
import path from "node:path";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { SecuxSUI } from "../src/app-sui";

type Ref = { objectId: string; version: string; digest: string };
type Asset = { name: "sui" | "token"; type: string; amount: bigint; object: Ref };
type GasMode = "object" | "address";
type Funding = "address" | "object" | "mixed";

const root = process.argv[2];
if (!root) throw new Error("Missing package root");
const output = path.join(root, "__tests__", "firmware-content-v2");

const derivationPath = "m/44'/784'/0'/0'/0'";
const publickey = "0590f56b2f3f3bfff5b73b77e29f7b110e9619b4c2d91f188c4ffb75708deb15";
const sender = SecuxSUI.addressConvert(publickey);
const recipient = "0xb249635cabe0218c96b1f91bc76db8da0dc03a0c7fe1b6919fa563b0c29f96e6";
const SUI = "0x2::sui::SUI";
const TOKEN = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const gasPrice = "1000";
const gasBudget = "5000000";
const expiration = {
  ValidDuring: {
    minEpoch: "555",
    maxEpoch: "556",
    minTimestamp: null,
    maxTimestamp: null,
    // Deterministic 32-byte chain identifier fixture (base58 encoded).
    chain: "GjADgMR1UYcvxQXv63mzt4eAvDqnoYABNoCy7kNdS57u",
    nonce: 123456789,
  },
};

const gas: Ref = {
  objectId: "0xb636777b78dd9cd2f56064e432d6a678e28c6c4a6c35f0b8fdd167bcdcb4e5ea",
  version: "839757834",
  digest: "GjADgMR1UYcvxQXv63mzt4eAvDqnoYABNoCy7kNdS57u",
};
const suiObject: Ref = {
  objectId: "0x93c46a59f0c151c125678233a2510562a6e9f6960fbf6f9b480129851540f8f8",
  version: "839757833",
  digest: "4Hz8WQ9qz46PkcFqend6bp8J1ijWv2dwUoUkDvSjSn15",
};
const tokenObject: Ref = {
  objectId: "0x5712f9678cfa5906448da28f3b4f23d7939399af31539ea4f496af399280b9be",
  version: "839757834",
  digest: "4Hz8WQ9qz46PkcFqend6bp8J1ijWv2dwUoUkDvSjSn15",
};
const assets: Asset[] = [
  { name: "sui", type: SUI, amount: BigInt("1000000000"), object: suiObject },
  { name: "token", type: TOKEN, amount: BigInt("1011778"), object: tokenObject },
];
const manifest: Array<Record<string, unknown>> = [];

function json(value: unknown) {
  return `${JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2)}\n`;
}

function bytes(value: string | Buffer) {
  return typeof value === "string" ? Buffer.from(value, "base64") : Buffer.from(value);
}

function extractSigningPayload(commandData: Buffer) {
  const apduDataLength = commandData.readUInt16LE(4);
  const apduData = commandData.subarray(6, 6 + apduDataLength);
  if (apduData[0] !== 1) throw new Error("Expected exactly one transaction");
  const payloadLengthOffset = 2 + apduData[1];
  const payloadLength = apduData.readUInt16BE(payloadLengthOffset);
  return Buffer.from(apduData.subarray(payloadLengthOffset + 2, payloadLengthOffset + 2 + payloadLength));
}

function write(name: string, request: Record<string, unknown>, prepared: any, kind?: Uint8Array) {
  const directory = path.join(output, name);
  fs.mkdirSync(directory, { recursive: true });
  const rawTx = bytes(prepared.rawTx);
  const commandData = bytes(prepared.commandData);
  const signingPayload = Buffer.concat([Buffer.from([0, 0, 0]), rawTx]);
  if (!extractSigningPayload(commandData).equals(signingPayload)) {
    throw new Error(`${name}: APDU payload does not match intent + rawTx`);
  }
  const decoded = bcs.TransactionData.parse(rawTx) as any;
  const ptb = decoded.V1.kind.ProgrammableTransaction;

  fs.writeFileSync(path.join(directory, "request.json"), json(request));
  fs.writeFileSync(path.join(directory, "rawTx.hex"), `${rawTx.toString("hex")}\n`);
  fs.writeFileSync(path.join(directory, "signingPayload.hex"), `${signingPayload.toString("hex")}\n`);
  fs.writeFileSync(path.join(directory, "commandData.hex"), `${commandData.toString("hex")}\n`);
  fs.writeFileSync(path.join(directory, "decoded.json"), json(decoded));
  if (kind) {
    const rebuilt = Transaction.fromKind(kind);
    const data = Transaction.from(rawTx).getData();
    rebuilt.setSender(data.sender!);
    rebuilt.setGasOwner(data.gasData.owner!);
    rebuilt.setGasPrice(data.gasData.price!);
    rebuilt.setGasBudget(data.gasData.budget!);
    rebuilt.setGasPayment(data.gasData.payment ?? []);
    rebuilt.setExpiration(data.expiration);
    // prepareSignBalance already performed this round-trip; retain kind bytes for FW fixtures.
    fs.writeFileSync(path.join(directory, "transactionKind.hex"), `${Buffer.from(kind).toString("hex")}\n`);
    fs.writeFileSync(path.join(directory, "transactionKind.base64"), `${Buffer.from(kind).toString("base64")}\n`);
  }
  fs.writeFileSync(path.join(directory, "expected.json"), json({
    sender,
    recipient,
    amount: String(request.amount),
    coinType: request.type,
    inputs: ptb.inputs.map((input: any) => input.$kind),
    commands: ptb.commands.map((command: any) => command.$kind),
    moveCalls: ptb.commands
      .filter((command: any) => command.$kind === "MoveCall")
      .map((command: any) => `${command.MoveCall.package}::${command.MoveCall.module}::${command.MoveCall.function}`),
    gasPaymentCount: decoded.V1.gasData.payment.length,
    expiration: decoded.V1.expiration,
  }));
  manifest.push({
    name,
    method: name.startsWith("pure-object-")
      ? "prepareSignObject"
      : name.startsWith("pure-address-")
        ? "prepareSignAddress"
        : "prepareSignBalance",
    request,
    rawTxBase64: rawTx.toString("base64"),
    commandDataBase64: commandData.toString("base64"),
  });
  console.log(`${name}: rawTx=${rawTx.length}, kind=${kind?.length ?? 0}, command=${commandData.length}`);
}

function base(asset: Asset, gasMode: GasMode) {
  return {
    publickey,
    to: recipient,
    amount: asset.amount.toString(),
    type: asset.type,
    gasPrice,
    gasBudget,
    gasPayment: gasMode === "object" ? [gas] : [],
    expiration: gasMode === "address" ? expiration : { None: true },
  };
}

async function pureObject(asset: Asset) {
  const request: any = base(asset, "object");
  if (asset.name === "token") request.tokens = [asset.object];
  // Native SUI object transfer intentionally uses tx.gas, matching the public API.
  const prepared = await SecuxSUI.prepareSignObject(derivationPath, request);
  write(`pure-object-${asset.name}`, { path: derivationPath, ...request }, prepared);
}

async function pureAddress(asset: Asset) {
  const request = base(asset, "address");
  const prepared = await SecuxSUI.prepareSignAddress(derivationPath, request);
  write(`pure-address-${asset.name}`, { path: derivationPath, ...request }, prepared);
}

function buildResolvedKind(asset: Asset, funding: Funding) {
  const tx = new Transaction();
  let balance: any;

  if (funding === "address") {
    const withdrawal = tx.withdrawal({ amount: asset.amount, type: asset.type });
    [balance] = tx.moveCall({
      target: "0x2::balance::redeem_funds",
      typeArguments: [asset.type],
      arguments: [withdrawal],
    });
  } else {
    const objectCoin = tx.objectRef(asset.object);
    const sources: any[] = [objectCoin];
    if (funding === "mixed") {
      const addressPart = asset.amount / BigInt(3);
      const withdrawal = tx.withdrawal({ amount: addressPart, type: asset.type });
      const [addressCoin] = tx.moveCall({
        target: "0x2::coin::redeem_funds",
        typeArguments: [asset.type],
        arguments: [withdrawal],
      });
      sources.push(addressCoin);
    }
    if (sources.length > 1) tx.mergeCoins(sources[0], sources.slice(1));
    const [exactCoin] = tx.splitCoins(sources[0], [tx.pure.u64(asset.amount)]);
    [balance] = tx.moveCall({
      target: "0x2::coin::into_balance",
      typeArguments: [asset.type],
      arguments: [exactCoin],
    });
    // Official resolver returns unused input balance to the signer.
    tx.moveCall({
      target: "0x2::coin::send_funds",
      typeArguments: [asset.type],
      arguments: [sources[0], tx.pure.address(sender)],
    });
  }

  tx.moveCall({
    target: "0x2::balance::send_funds",
    typeArguments: [asset.type],
    arguments: [balance, tx.pure.address(recipient)],
  });
  return tx;
}

async function transactionKind(asset: Asset, funding: Funding, gasMode: GasMode) {
  const resolved = buildResolvedKind(asset, funding);
  const kind = await resolved.build({ onlyTransactionKind: true });
  const request = {
    ...base(asset, gasMode),
    transactionKind: Buffer.from(kind).toString("base64"),
    gasOwner: sender,
  };
  const prepared = await SecuxSUI.prepareSignBalance(derivationPath, request);
  write(
    `transaction-kind-${asset.name}-${funding}-${gasMode}-gas`,
    { path: derivationPath, ...request },
    prepared,
    kind,
  );
}

async function expectRejected(label: string, request: any) {
  try {
    await SecuxSUI.prepareSignBalance(derivationPath, request);
  } catch {
    return;
  }
  throw new Error(`Policy unexpectedly accepted ${label}`);
}

async function main() {
  for (const asset of assets) {
    await pureObject(asset);
    await pureAddress(asset);
    for (const funding of ["address", "object", "mixed"] as const) {
      for (const gasMode of ["object", "address"] as const) {
        await transactionKind(asset, funding, gasMode);
      }
    }
  }

  const good = buildResolvedKind(assets[1], "mixed");
  const goodKind = await good.build({ onlyTransactionKind: true });
  const evil = Transaction.fromKind(goodKind);
  evil.moveCall({ target: "0x3::forbidden::call", arguments: [] });
  await expectRejected("custom Move package", {
    ...base(assets[1], "object"),
    transactionKind: Buffer.from(await evil.build({ onlyTransactionKind: true })).toString("base64"),
    gasOwner: sender,
  });
  fs.writeFileSync(path.join(output, "manifest.json"), json({
    mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    path: derivationPath,
    publickey,
    sender,
    cases: manifest,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
