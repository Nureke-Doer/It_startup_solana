import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("CFvWtQbdLxeJz55CfJLbpqyqFaUFsNZPuWMU7KcPgnE2");
export const RAYDIUM_CLMM_DEVNET = new PublicKey("devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH");
export const AMM_CONFIG_DEVNET = new PublicKey("B9H7TR8PSjJT7nuW2tuPkFC63z7drtMZ4LoCtD7PrCN1");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

// Дефолтные адреса развёрнутого стенда в Solana Devnet (обновляются после деплоя)
export const DEVNET_DEPOSIT_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_DEPOSIT_MINT ?? "wKGeYnbJWf2iqakmqFkYGcnmWHQ2roJ6jJ1664Zf2oR"
);
export const DEVNET_SECONDARY_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_SECONDARY_MINT ?? "EWXdK61y5MT8HfZypYJBLNj2A2paRAc5pXojcpeFkRwu"
);
export const DEVNET_POOL_STATE = new PublicKey(
  process.env.NEXT_PUBLIC_POOL_STATE ?? "DKRQA3X9R6oneVnfgXEtCZdQmPRyASYV6rLXv7dBBD3n"
);

// 8-байтные дискриминаторы инструкций Anchor (`sha256("global:<name>")[..8]`)
const IX_DISCRIMINATORS = {
  initialize_vault: Uint8Array.from([48, 191, 163, 44, 71, 129, 63, 164]),
  create_user_card: Uint8Array.from([202, 161, 134, 92, 232, 23, 166, 179]),
  deposit: Uint8Array.from([242, 35, 198, 137, 82, 225, 242, 182]),
  withdraw: Uint8Array.from([183, 18, 70, 156, 148, 109, 161, 34]),
  swap: Uint8Array.from([248, 198, 158, 145, 225, 117, 135, 200]),
  collect_fees: Uint8Array.from([164, 152, 207, 99, 30, 186, 19, 182]),
  close_position: Uint8Array.from([123, 134, 81, 0, 49, 68, 98, 98]),
};

export interface DecodedVaultState {
  address: PublicKey;
  admin: PublicKey;
  depositMint: PublicKey;
  shareMint: PublicKey;
  tokenVault: PublicKey;
  totalDeposited: bigint;
  totalShares: bigint;
}

export interface DecodedUserCard {
  address: PublicKey;
  vault: PublicKey;
  owner: PublicKey;
  depositedAmount: bigint;
  sharesMinted: bigint;
}

export interface DecodedStrategy {
  address: PublicKey;
  vault: PublicKey;
  clmmProgram: PublicKey;
  poolState: PublicKey;
  ammConfig: PublicKey;
  secondaryMint: PublicKey;
  secondaryVault: PublicKey;
  positionNftMint: PublicKey;
  positionNftAccount: PublicKey;
  personalPosition: PublicKey;
  tickLowerIndex: number;
  tickUpperIndex: number;
  liquidity: bigint;
  activePosition: boolean;
}

export interface DecodedPoolSummary {
  address: PublicKey;
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
  tokenVault0: PublicKey;
  tokenVault1: PublicKey;
  observationKey: PublicKey;
  decimals0: number;
  decimals1: number;
  tickSpacing: number;
  tickCurrent: number;
  price: number;
  liquidity: bigint;
}

export function deriveVaultPda(depositMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), depositMint.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function deriveTokenVaultPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_token"), vault.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function deriveShareMintPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("share_mint"), vault.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function deriveUserCardPda(vault: PublicKey, user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_card"), vault.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function deriveStrategyPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("strategy"), vault.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function deriveSecondaryVaultPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("strategy_vault"), vault.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function deriveAta(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

function readU64LE(buf: Uint8Array, offset: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getBigUint64(offset, true);
}

function readI32LE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getInt32(offset, true);
}

function readU16LE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getUint16(offset, true);
}

function readU128LE(buf: Uint8Array, offset: number): bigint {
  const lo = readU64LE(buf, offset);
  const hi = readU64LE(buf, offset + 8);
  return (hi << 64n) | lo;
}

export function formatUiAmount(raw: bigint, decimals = 6): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole.toString()}.${fracStr}` : `${whole.toString()}.0`;
}

export function parseUiAmountToRaw(input: string, decimals = 6): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const [wholePart, fracPart = ""] = trimmed.split(".");
  if (fracPart.length > decimals) {
    return null;
  }
  const paddedFrac = fracPart.padEnd(decimals, "0");
  const raw = BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(paddedFrac || "0");
  return raw > 0n ? raw : null;
}

export async function fetchTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<bigint> {
  const info = await connection.getAccountInfo(tokenAccount);
  if (!info || info.data.length < 72) {
    return 0n;
  }
  return readU64LE(info.data, 64);
}

export async function fetchMintSupply(connection: Connection, mint: PublicKey): Promise<bigint> {
  const info = await connection.getAccountInfo(mint);
  if (!info || info.data.length < 82) {
    return 0n;
  }
  return readU64LE(info.data, 36);
}

export async function fetchMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const info = await connection.getAccountInfo(mint);
  if (!info || info.data.length < 45) {
    return 6;
  }
  return info.data[44];
}

export async function fetchVaultState(
  connection: Connection,
  depositMint: PublicKey
): Promise<DecodedVaultState | null> {
  const vault = deriveVaultPda(depositMint);
  const info = await connection.getAccountInfo(vault);
  if (!info || info.data.length < 8 + 147) {
    return null;
  }
  const d = info.data;
  return {
    address: vault,
    admin: new PublicKey(d.slice(8, 40)),
    depositMint: new PublicKey(d.slice(40, 72)),
    shareMint: new PublicKey(d.slice(72, 104)),
    tokenVault: new PublicKey(d.slice(104, 136)),
    totalDeposited: readU64LE(d, 136),
    totalShares: readU64LE(d, 144),
  };
}

export async function fetchUserCard(
  connection: Connection,
  vault: PublicKey,
  user: PublicKey
): Promise<DecodedUserCard | null> {
  const card = deriveUserCardPda(vault, user);
  const info = await connection.getAccountInfo(card);
  if (!info || info.data.length < 8 + 81) {
    return null;
  }
  const d = info.data;
  return {
    address: card,
    vault: new PublicKey(d.slice(8, 40)),
    owner: new PublicKey(d.slice(40, 72)),
    depositedAmount: readU64LE(d, 72),
    sharesMinted: readU64LE(d, 80),
  };
}

export async function fetchStrategyState(
  connection: Connection,
  vault: PublicKey
): Promise<DecodedStrategy | null> {
  const strategy = deriveStrategyPda(vault);
  const info = await connection.getAccountInfo(strategy);
  if (!info || info.data.length < 8 + 315) {
    return null;
  }
  const d = info.data;
  return {
    address: strategy,
    vault: new PublicKey(d.slice(8, 40)),
    clmmProgram: new PublicKey(d.slice(40, 72)),
    poolState: new PublicKey(d.slice(72, 104)),
    ammConfig: new PublicKey(d.slice(104, 136)),
    secondaryMint: new PublicKey(d.slice(136, 168)),
    secondaryVault: new PublicKey(d.slice(168, 200)),
    positionNftMint: new PublicKey(d.slice(200, 232)),
    positionNftAccount: new PublicKey(d.slice(232, 264)),
    personalPosition: new PublicKey(d.slice(264, 296)),
    tickLowerIndex: readI32LE(d, 296),
    tickUpperIndex: readI32LE(d, 300),
    liquidity: readU128LE(d, 304),
    activePosition: d[320] === 1,
  };
}

export async function fetchPoolSummary(
  connection: Connection,
  poolAddress: PublicKey
): Promise<DecodedPoolSummary | null> {
  const info = await connection.getAccountInfo(poolAddress);
  if (!info || info.data.length < 273) {
    return null;
  }
  const d = info.data;
  const decimals0 = d[233];
  const decimals1 = d[234];
  const tickSpacing = readU16LE(d, 235);
  const liquidity = readU128LE(d, 237);
  const sqrtPriceX64 = readU128LE(d, 253);
  const tickCurrent = readI32LE(d, 269);
  const sqrtP = Number(sqrtPriceX64) / Number(1n << 64n);
  const price = sqrtP * sqrtP * 10 ** (decimals0 - decimals1);

  return {
    address: poolAddress,
    tokenMint0: new PublicKey(d.slice(73, 105)),
    tokenMint1: new PublicKey(d.slice(105, 137)),
    tokenVault0: new PublicKey(d.slice(137, 169)),
    tokenVault1: new PublicKey(d.slice(169, 201)),
    observationKey: new PublicKey(d.slice(201, 233)),
    decimals0,
    decimals1,
    tickSpacing,
    tickCurrent,
    price,
    liquidity,
  };
}

export function buildCreateUserCardIx(user: PublicKey, depositMint: PublicKey): TransactionInstruction {
  const vault = deriveVaultPda(depositMint);
  const userCard = deriveUserCardPda(vault, user);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: userCard, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX_DISCRIMINATORS.create_user_card),
  });
}

export function buildDepositIx(
  user: PublicKey,
  depositMint: PublicKey,
  amountRaw: bigint
): TransactionInstruction {
  const vault = deriveVaultPda(depositMint);
  const tokenVault = deriveTokenVaultPda(vault);
  const shareMint = deriveShareMintPda(vault);
  const userCard = deriveUserCardPda(vault, user);
  const userTokenAccount = deriveAta(user, depositMint);
  const userShareAccount = deriveAta(user, shareMint);

  const data = Buffer.alloc(16);
  data.set(IX_DISCRIMINATORS.deposit, 0);
  data.writeBigUInt64LE(amountRaw, 8);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: userCard, isSigner: false, isWritable: true },
      { pubkey: depositMint, isSigner: false, isWritable: false },
      { pubkey: shareMint, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenVault, isSigner: false, isWritable: true },
      { pubkey: userShareAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildWithdrawIx(
  user: PublicKey,
  depositMint: PublicKey,
  sharesRaw: bigint
): TransactionInstruction {
  const vault = deriveVaultPda(depositMint);
  const tokenVault = deriveTokenVaultPda(vault);
  const shareMint = deriveShareMintPda(vault);
  const userCard = deriveUserCardPda(vault, user);
  const userTokenAccount = deriveAta(user, depositMint);
  const userShareAccount = deriveAta(user, shareMint);

  const data = Buffer.alloc(16);
  data.set(IX_DISCRIMINATORS.withdraw, 0);
  data.writeBigUInt64LE(sharesRaw, 8);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: userCard, isSigner: false, isWritable: true },
      { pubkey: depositMint, isSigner: false, isWritable: false },
      { pubkey: shareMint, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenVault, isSigner: false, isWritable: true },
      { pubkey: userShareAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function tickArrayStartIndex(tickCurrent: number, tickSpacing: number): number {
  const ticksInArray = 60 * tickSpacing;
  return Math.floor(tickCurrent / ticksInArray) * ticksInArray;
}

function deriveTickArrayPda(poolState: PublicKey, startTickIndex: number): PublicKey {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(startTickIndex, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tick_array"), poolState.toBuffer(), buf],
    RAYDIUM_CLMM_DEVNET
  )[0];
}

function deriveProtocolPositionPda(
  poolState: PublicKey,
  tickLower: number,
  tickUpper: number
): PublicKey {
  const lowerBuf = Buffer.alloc(4);
  const upperBuf = Buffer.alloc(4);
  lowerBuf.writeInt32BE(tickLower, 0);
  upperBuf.writeInt32BE(tickUpper, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), poolState.toBuffer(), lowerBuf, upperBuf],
    RAYDIUM_CLMM_DEVNET
  )[0];
}

function deriveBitmapExtensionPda(poolState: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_tick_array_bitmap_extension"), poolState.toBuffer()],
    RAYDIUM_CLMM_DEVNET
  )[0];
}

export function buildVaultSwapIx(
  admin: PublicKey,
  vaultState: DecodedVaultState,
  strategy: DecodedStrategy,
  pool: DecodedPoolSummary,
  amountInRaw: bigint,
  minAmountOutRaw: bigint,
  aToB: boolean
): TransactionInstruction {
  const inputMint = aToB ? vaultState.depositMint : strategy.secondaryMint;
  const zeroForOne = inputMint.equals(pool.tokenMint0);
  const inputPoolVault = zeroForOne ? pool.tokenVault0 : pool.tokenVault1;
  const outputPoolVault = zeroForOne ? pool.tokenVault1 : pool.tokenVault0;

  const bitmapExt = deriveBitmapExtensionPda(pool.address);
  const currentStart = tickArrayStartIndex(pool.tickCurrent, pool.tickSpacing);
  const currentTickArray = deriveTickArrayPda(pool.address, currentStart);

  const data = Buffer.alloc(8 + 8 + 8 + 16 + 1);
  data.set(IX_DISCRIMINATORS.swap, 0);
  data.writeBigUInt64LE(amountInRaw, 8);
  data.writeBigUInt64LE(minAmountOutRaw, 16);
  // sqrt_price_limit_x64 = 0 (16 bytes of 0 at offset 24..40)
  data.writeUInt8(aToB ? 1 : 0, 40);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: vaultState.address, isSigner: false, isWritable: true },
      { pubkey: strategy.address, isSigner: false, isWritable: true },
      { pubkey: vaultState.tokenVault, isSigner: false, isWritable: true },
      { pubkey: strategy.secondaryVault, isSigner: false, isWritable: true },
      { pubkey: vaultState.depositMint, isSigner: false, isWritable: false },
      { pubkey: strategy.secondaryMint, isSigner: false, isWritable: false },
      { pubkey: strategy.clmmProgram, isSigner: false, isWritable: false },
      { pubkey: strategy.ammConfig, isSigner: false, isWritable: false },
      { pubkey: strategy.poolState, isSigner: false, isWritable: true },
      { pubkey: inputPoolVault, isSigner: false, isWritable: true },
      { pubkey: outputPoolVault, isSigner: false, isWritable: true },
      { pubkey: pool.observationKey, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: bitmapExt, isSigner: false, isWritable: true },
      { pubkey: currentTickArray, isSigner: false, isWritable: true },
    ],
    data,
  });
}

export function buildCollectFeesIx(
  admin: PublicKey,
  vaultState: DecodedVaultState,
  strategy: DecodedStrategy,
  pool: DecodedPoolSummary
): TransactionInstruction {
  const lowerStart = tickArrayStartIndex(strategy.tickLowerIndex, pool.tickSpacing);
  const upperStart = tickArrayStartIndex(strategy.tickUpperIndex, pool.tickSpacing);
  const protocolPosition = deriveProtocolPositionPda(
    pool.address,
    strategy.tickLowerIndex,
    strategy.tickUpperIndex
  );
  const tickArrayLower = deriveTickArrayPda(pool.address, lowerStart);
  const tickArrayUpper = deriveTickArrayPda(pool.address, upperStart);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: vaultState.address, isSigner: false, isWritable: true },
      { pubkey: strategy.address, isSigner: false, isWritable: true },
      { pubkey: strategy.positionNftAccount, isSigner: false, isWritable: false },
      { pubkey: strategy.personalPosition, isSigner: false, isWritable: true },
      { pubkey: pool.address, isSigner: false, isWritable: true },
      { pubkey: protocolPosition, isSigner: false, isWritable: true },
      { pubkey: pool.tokenVault0, isSigner: false, isWritable: true },
      { pubkey: pool.tokenVault1, isSigner: false, isWritable: true },
      { pubkey: tickArrayLower, isSigner: false, isWritable: true },
      { pubkey: tickArrayUpper, isSigner: false, isWritable: true },
      { pubkey: vaultState.tokenVault, isSigner: false, isWritable: true },
      { pubkey: strategy.secondaryVault, isSigner: false, isWritable: true },
      { pubkey: vaultState.depositMint, isSigner: false, isWritable: false },
      { pubkey: strategy.secondaryMint, isSigner: false, isWritable: false },
      { pubkey: strategy.clmmProgram, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX_DISCRIMINATORS.collect_fees),
  });
}

export function buildClosePositionIx(
  admin: PublicKey,
  vaultState: DecodedVaultState,
  strategy: DecodedStrategy,
  pool: DecodedPoolSummary,
  amount0MinRaw: bigint,
  amount1MinRaw: bigint
): TransactionInstruction {
  const lowerStart = tickArrayStartIndex(strategy.tickLowerIndex, pool.tickSpacing);
  const upperStart = tickArrayStartIndex(strategy.tickUpperIndex, pool.tickSpacing);
  const protocolPosition = deriveProtocolPositionPda(
    pool.address,
    strategy.tickLowerIndex,
    strategy.tickUpperIndex
  );
  const tickArrayLower = deriveTickArrayPda(pool.address, lowerStart);
  const tickArrayUpper = deriveTickArrayPda(pool.address, upperStart);

  const data = Buffer.alloc(24);
  data.set(IX_DISCRIMINATORS.close_position, 0);
  data.writeBigUInt64LE(amount0MinRaw, 8);
  data.writeBigUInt64LE(amount1MinRaw, 16);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: vaultState.address, isSigner: false, isWritable: true },
      { pubkey: strategy.address, isSigner: false, isWritable: true },
      { pubkey: strategy.positionNftMint, isSigner: false, isWritable: true },
      { pubkey: strategy.positionNftAccount, isSigner: false, isWritable: true },
      { pubkey: strategy.personalPosition, isSigner: false, isWritable: true },
      { pubkey: pool.address, isSigner: false, isWritable: true },
      { pubkey: protocolPosition, isSigner: false, isWritable: true },
      { pubkey: pool.tokenVault0, isSigner: false, isWritable: true },
      { pubkey: pool.tokenVault1, isSigner: false, isWritable: true },
      { pubkey: tickArrayLower, isSigner: false, isWritable: true },
      { pubkey: tickArrayUpper, isSigner: false, isWritable: true },
      { pubkey: vaultState.tokenVault, isSigner: false, isWritable: true },
      { pubkey: strategy.secondaryVault, isSigner: false, isWritable: true },
      { pubkey: vaultState.depositMint, isSigner: false, isWritable: false },
      { pubkey: strategy.secondaryMint, isSigner: false, isWritable: false },
      { pubkey: strategy.clmmProgram, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export { SYSVAR_RENT_PUBKEY };

