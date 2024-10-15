import { nu64, struct, u32, u8, Layout } from "@solana/buffer-layout";
import { Connection, PublicKey } from "@solana/web3.js";
import type { ParsedAccountData } from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import dotenv from "dotenv";
import { logger } from "./logger";

class PublicKeyLayout extends Layout<PublicKey> {
  constructor(property: string) {
    super(32, property);
  }

  decode(buffer: Buffer, offset = 0): PublicKey {
    return new PublicKey(buffer.slice(offset, offset + this.span));
  }

  encode(src: PublicKey, buffer: Buffer, offset = 0): number {
    buffer.set(src.toBytes(), offset);
    return this.span;
  }
}

const publicKey = (property: string) => new PublicKeyLayout(property);

// Custom bool layout
class BoolLayout extends Layout<boolean> {
  constructor(property: string) {
    super(1, property);
  }

  decode(buffer: Buffer, offset = 0): boolean {
    return buffer[offset] === 1;
  }

  encode(src: boolean, buffer: Buffer, offset = 0): number {
    buffer[offset] = src ? 1 : 0;
    return this.span;
  }
}

const bool = (property: string) => new BoolLayout(property);

export interface Token {
  mintAuthorityOption: 1 | 0;
  mintAuthority: PublicKey;
  supply: bigint;
  decimals: number;
  isInitialized: boolean;
  freezeAuthorityOption: 1 | 0;
  freezeAuthority: PublicKey;
}

export const MintLayout = struct<Token>([
  u32("mintAuthorityOption"),
  publicKey("mintAuthority"),
  nu64("supply"),
  u8("decimals"),
  bool("isInitialized"),
  u32("freezeAuthorityOption"),
  publicKey("freezeAuthority"),
]);

export const fetchAndParseMint = async (
  mint: PublicKey,
  solanaConnection: Connection
): Promise<Token | null> => {
  try {
    let { data } = (await solanaConnection.getAccountInfo(mint)) || {};
    if (!data) return null;

    return MintLayout.decode(data);
  } catch {
    return null;
  }
};

export const fetchLiqudityPoolState = async (
  pool: PublicKey,
  solanaConnection: Connection
) => {
  try {
    const acc = await solanaConnection.getMultipleAccountsInfo([
      new PublicKey(pool),
    ]);
    const parsed = acc.map((v: any) =>
      LIQUIDITY_STATE_LAYOUT_V4.decode(v.data)
    );

    const lpMint = parsed[0].lpMint;
    const lpReserve = parsed[0].lpReserve;

    const accInfo = await solanaConnection.getParsedAccountInfo(
      new PublicKey(lpMint)
    );
    const mintInfo = (accInfo.value?.data as ParsedAccountData)?.parsed?.info;

    const lpReserve2 = lpReserve / Math.pow(10, mintInfo?.decimals);
    const actualSupply = mintInfo?.supply / Math.pow(10, mintInfo?.decimals);

    //Calculate burn percentage
    const maxLpSupply = Math.max(actualSupply, lpReserve - 1);
    const burnAmt = lpReserve - actualSupply;
    const burnPct = (burnAmt / lpReserve) * 100;

    return burnPct;
  } catch {
    return null;
  }
};

export async function checkToken(mintAddress: string, connection: Connection) {
  const mintPublicKey = new PublicKey(mintAddress);

  const result = await fetchAndParseMint(mintPublicKey, connection);

  if (result) {
    if (
      result.mintAuthorityOption === 0 &&
      result.freezeAuthorityOption === 0
    ) {
      logger.info(
        "This token is safe to trade; it is neither a scam nor a honeypot."
      );
    } else {
      logger.warn(
        "This token is potentially risky; it might be a scam or honeypot."
      );
    }
  } else {
    logger.error("Unable to fetch or parse token information");
  }
}

export async function checkLPBurnedState(
  poolAddress: string,
  connection: Connection
) {
  const poolPublicKey = new PublicKey(poolAddress);

  const result = await fetchLiqudityPoolState(poolPublicKey, connection);

  if (result !== null) {
    if (result === 100) {
      logger.info("The token's liquidity pool (LP) is 100% burned");
    } else {
      logger.warn(`The token's liquidity pool (LP) is ${100 - result}% burned`);
    }
  } else {
    logger.error("Unable to fetch or parse liquidity pool state");
  }
}
