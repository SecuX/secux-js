import { Crypto } from "./crypto";
import { numberToBytesBE } from "@noble/curves/abstract/utils";
import { mod } from "@noble/curves/abstract/modular";


export function pointFromScalar(value: string | Uint8Array, isCompressed: boolean): Buffer {
    const p = Crypto.secp256k1.ProjectivePoint.fromPrivateKey(value);
    const key = p.toHex(isCompressed);

    return Buffer.from(key, "hex");
}

export function isPoint(value: string | Uint8Array): boolean {
    try {
        Crypto.secp256k1.ProjectivePoint.fromHex(value);

        return true;
    } catch (error) {
        // do nothing
    }

    return false;
}

export function isPrivate(value: string | Uint8Array): boolean {
    return Crypto.secp256k1.utils.isValidPrivateKey(value);
}

export function pointAdd(P: string | Uint8Array, Q: string | Uint8Array, isCompressed: boolean): Buffer {
    const p = Crypto.secp256k1.ProjectivePoint.fromHex(P);
    const q = Crypto.secp256k1.ProjectivePoint.fromHex(Q);
    const add = p.add(q);
    const key = add.toHex(isCompressed);

    return Buffer.from(key, "hex");
}

export function pointCompress(value: string | Uint8Array, isCompressed: boolean): Buffer {
    const p = Crypto.secp256k1.ProjectivePoint.fromHex(value);
    const key = p.toHex(isCompressed);

    return Buffer.from(key, "hex");
}

export function privateAdd(key: string | Uint8Array, tweak: string | Uint8Array): Buffer {
    const normal = Crypto.secp256k1.utils.normPrivateKeyToScalar;
    const add = mod(normal(key) + normal(tweak), Crypto.secp256k1.CURVE.n);

    return Buffer.from(numberToBytesBE(add, 32));
}

export function privateNegate(key: string | Uint8Array): Buffer {
    const normal = Crypto.secp256k1.utils.normPrivateKeyToScalar as
        (key: string | Uint8Array) => bigint;
    const neg = mod(-normal(key), Crypto.secp256k1.CURVE.n);

    return Buffer.from(numberToBytesBE(neg, 32));
}
