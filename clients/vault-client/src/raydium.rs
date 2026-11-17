use anchor_lang::prelude::Pubkey;
use std::str::FromStr;

/// Адрес программы Raydium CLMM в Solana Devnet.
pub const RAYDIUM_CLMM_DEVNET_STR: &str = "devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH";

/// Адрес `AmmConfig` Raydium CLMM в Devnet (`index = 1, tick_spacing = 60, trade_fee = 2500` = 0.25%).
pub const DEFAULT_AMM_CONFIG_DEVNET_STR: &str = "B9H7TR8PSjJT7nuW2tuPkFC63z7drtMZ4LoCtD7PrCN1";

pub const TOKEN_PROGRAM_STR: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
pub const TOKEN_2022_PROGRAM_STR: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
pub const ATA_PROGRAM_STR: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
pub const MEMO_PROGRAM_STR: &str = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

pub fn raydium_clmm_program_id() -> Pubkey {
    Pubkey::from_str(RAYDIUM_CLMM_DEVNET_STR).unwrap()
}

pub fn default_amm_config_id() -> Pubkey {
    Pubkey::from_str(DEFAULT_AMM_CONFIG_DEVNET_STR).unwrap()
}

pub fn token_program_id() -> Pubkey {
    Pubkey::from_str(TOKEN_PROGRAM_STR).unwrap()
}

pub fn token_2022_program_id() -> Pubkey {
    Pubkey::from_str(TOKEN_2022_PROGRAM_STR).unwrap()
}

pub fn ata_program_id() -> Pubkey {
    Pubkey::from_str(ATA_PROGRAM_STR).unwrap()
}

pub fn memo_program_id() -> Pubkey {
    Pubkey::from_str(MEMO_PROGRAM_STR).unwrap()
}

pub fn rent_sysvar_id() -> Pubkey {
    Pubkey::from_str("SysvarRent111111111111111111111111111111111").unwrap()
}
