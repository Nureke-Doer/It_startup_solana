pub mod raydium;
pub mod rpc;
pub mod vault;

use std::{env, fs, path::PathBuf, str::FromStr};

use anchor_lang::prelude::Pubkey;
use anyhow::{anyhow, bail, Context, Result};
use solana_keypair::Keypair;
use solana_signer::Signer;

use crate::rpc::RpcClient;

/// Адреса развёрнутых артефактов в Solana Devnet по умолчанию (обновляются после деплоя).
pub const DEFAULT_DEPOSIT_MINT_DEVNET: &str = "wKGeYnbJWf2iqakmqFkYGcnmWHQ2roJ6jJ1664Zf2oR";

fn load_keypair(custom_path: Option<&str>) -> Result<Keypair> {
    let candidates: Vec<PathBuf> = if let Some(p) = custom_path {
        vec![PathBuf::from(p)]
    } else {
        let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
        vec![
            PathBuf::from("../.keys/id.json"),
            PathBuf::from(".keys/id.json"),
            PathBuf::from(format!("{}/.config/solana/id.json", home)),
        ]
    };

    for path in &candidates {
        if path.exists() {
            let text = fs::read_to_string(path)
                .with_context(|| format!("Failed to read keypair file {}", path.display()))?;
            let bytes: Vec<u8> = serde_json::from_str(&text)
                .with_context(|| format!("Invalid JSON in keypair file {}", path.display()))?;
            let arr: [u8; 64] = bytes
                .try_into()
                .map_err(|_| anyhow!("Keypair in {} is not 64 bytes", path.display()))?;
            let secret: [u8; 32] = arr[0..32]
                .try_into()
                .map_err(|_| anyhow!("Invalid secret key slice in {}", path.display()))?;
            return Ok(Keypair::new_from_array(secret));
        }
    }

    bail!(
        "No Solana keypair found in {:?}",
        candidates
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
    )
}

fn parse_flag_value(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|idx| args.get(idx + 1).cloned())
}

fn has_flag(args: &[String], flag: &str) -> bool {
    args.iter().any(|a| a == flag)
}

fn print_help() {
    println!(
        "vault-client — Rust CLI for Liquidity Vault & Raydium CLMM (Weeks 8–13)

USAGE:
  cargo run -p vault-client -- <COMMAND> [OPTIONS]

GLOBAL OPTIONS:
  --cluster <devnet|localnet>   Target Solana cluster (default: devnet)
  --rpc-url <URL>               Custom RPC endpoint URL
  --keypair <PATH>              Wallet keypair path (default: ../.keys/id.json or ~/.config/solana/id.json)
  --mint <PUBKEY>               Base deposit token mint of the vault
  --secondary-mint <PUBKEY>     Secondary token mint of the Raydium CLMM pool
  --pool <PUBKEY>               Raydium CLMM PoolState address

COMMANDS:
  Week 8 (Vault Skeleton & PDAs):
    init                        Initialize VaultState, token_vault, and share_mint PDAs
    card                        Create personal UserCard PDA for the wallet
    show                        Show VaultState, UserCard, wallet balances, and Strategy state

  Week 9 (Deposit & Share Tokens):
    deposit --amount <UI_AMT>   Deposit tokens into vault and mint proportional share tokens

  Week 10 (CPI & Withdraw):
    withdraw --shares <UI_AMT>  Burn share tokens and withdraw proportional underlying tokens