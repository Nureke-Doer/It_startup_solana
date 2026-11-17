"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, type ReactNode } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? clusterApiUrl("devnet");

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [], []);
  const config = useMemo(() => ({ commitment: "confirmed" as const }), []);
  return (
    <ConnectionProvider endpoint={RPC_URL} config={config}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

