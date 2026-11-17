"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  buildClosePositionIx,
  buildCollectFeesIx,
  buildCreateUserCardIx,
  buildDepositIx,
  buildVaultSwapIx,
  buildWithdrawIx,
  DecodedPoolSummary,
  DecodedStrategy,
  DecodedUserCard,
  DecodedVaultState,
  deriveAta,
  deriveVaultPda,
  DEVNET_DEPOSIT_MINT,
  DEVNET_POOL_STATE,
  DEVNET_SECONDARY_MINT,
  fetchMintDecimals,
  fetchPoolSummary,
  fetchStrategyState,
  fetchTokenBalance,
  fetchUserCard,
  fetchVaultState,
  formatUiAmount,
  parseUiAmountToRaw,
  PROGRAM_ID,
  RAYDIUM_CLMM_DEVNET,
} from "../lib/vault";

export default function LiquidityVaultPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [mintInput, setMintInput] = useState<string>(DEVNET_DEPOSIT_MINT.toBase58());
  const [poolInput, setPoolInput] = useState<string>(DEVNET_POOL_STATE.toBase58());

  const [vaultState, setVaultState] = useState<DecodedVaultState | null>(null);
  const [userCard, setUserCard] = useState<DecodedUserCard | null>(null);
  const [strategy, setStrategy] = useState<DecodedStrategy | null>(null);
  const [poolSummary, setPoolSummary] = useState<DecodedPoolSummary | null>(null);

  const [depositDecimals, setDepositDecimals] = useState<number>(6);
  const [secondaryDecimals, setSecondaryDecimals] = useState<number>(6);
  const [vaultPrimaryBalance, setVaultPrimaryBalance] = useState<bigint>(0n);
  const [vaultSecondaryBalance, setVaultSecondaryBalance] = useState<bigint>(0n);
  const [userTokenBalance, setUserTokenBalance] = useState<bigint>(0n);
  const [userShareBalance, setUserShareBalance] = useState<bigint>(0n);

  const [depositAmount, setDepositAmount] = useState<string>("100");
  const [withdrawShares, setWithdrawShares] = useState<string>("50");
  const [swapAmount, setSwapAmount] = useState<string>("50");
  const [swapMinOut, setSwapMinOut] = useState<string>("45");
  const [swapDirection, setSwapDirection] = useState<"a_to_b" | "b_to_a">("a_to_b");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txStatus, setTxStatus] = useState<{
    type: "idle" | "pending" | "success" | "error";
    message: string;
    signature?: string;
  }>({ type: "idle", message: "" });

  const refreshState = useCallback(async () => {
    try {
      const depositMint = new PublicKey(mintInput.trim());
      const poolKey = new PublicKey(poolInput.trim());

      const [vs, decA, pool] = await Promise.all([
        fetchVaultState(connection, depositMint),
        fetchMintDecimals(connection, depositMint),
        fetchPoolSummary(connection, poolKey),
      ]);

      setDepositDecimals(decA);
      setVaultState(vs);
      setPoolSummary(pool);

      if (vs) {
        const [vaultBalA, strat] = await Promise.all([
          fetchTokenBalance(connection, vs.tokenVault),
          fetchStrategyState(connection, vs.address),
        ]);
        setVaultPrimaryBalance(vaultBalA);
        setStrategy(strat);

        if (strat) {
          const [decB, vaultBalB] = await Promise.all([
            fetchMintDecimals(connection, strat.secondaryMint),
            fetchTokenBalance(connection, strat.secondaryVault),
          ]);
          setSecondaryDecimals(decB);
          setVaultSecondaryBalance(vaultBalB);
        } else {
          setVaultSecondaryBalance(0n);
        }

        if (publicKey) {
          const userTokenAta = deriveAta(publicKey, depositMint);
          const userShareAta = deriveAta(publicKey, vs.shareMint);
          const [card, uTok, uShr] = await Promise.all([
            fetchUserCard(connection, vs.address, publicKey),
            fetchTokenBalance(connection, userTokenAta),
            fetchTokenBalance(connection, userShareAta),
          ]);
          setUserCard(card);
          setUserTokenBalance(uTok);
          setUserShareBalance(uShr);
        } else {
          setUserCard(null);
          setUserTokenBalance(0n);
          setUserShareBalance(0n);
        }
      } else {
        setStrategy(null);
        setUserCard(null);
      }
    } catch (err) {
      console.error("Failed to refresh on-chain state:", err);
    }
  }, [connection, mintInput, poolInput, publicKey]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  async function executeTx(label: string, buildFn: () => Promise<Transaction>) {
    if (!publicKey) {
      setTxStatus({
        type: "error",
        message: "Подключите кошелёк Phantom или Solflare (Devnet) перед отправкой транзакции.",
      });
      return;
    }
    setIsLoading(true);
    setTxStatus({ type: "pending", message: `Выполняется: ${label}...` });
    try {
      const tx = await buildFn();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection, { skipPreflight: false });
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setTxStatus({
        type: "success",
        message: `${label} успешно подтверждена в Solana Devnet!`,
        signature: sig,
      });
      await refreshState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTxStatus({
        type: "error",
        message: `Ошибка (${label}): ${msg}`,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreateUserCard = async () => {
    if (!publicKey) return;
    const depositMint = new PublicKey(mintInput.trim());
    await executeTx("Создание UserCard PDA", async () => {
      const tx = new Transaction();
      tx.add(buildCreateUserCardIx(publicKey, depositMint));
      return tx;
    });
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;
    const depositMint = new PublicKey(mintInput.trim());
    const rawAmount = parseUiAmountToRaw(depositAmount, depositDecimals);
    if (rawAmount === null) {
      setTxStatus({ type: "error", message: "Введите корректную положительную сумму депозита." });
      return;
    }
    await executeTx(`Депозит ${depositAmount} токенов в Vault`, async () => {
      const tx = new Transaction();
      if (!userCard) {
        tx.add(buildCreateUserCardIx(publicKey, depositMint));
      }
      tx.add(buildDepositIx(publicKey, depositMint, rawAmount));
      return tx;
    });
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;
    const depositMint = new PublicKey(mintInput.trim());
    const rawShares = parseUiAmountToRaw(withdrawShares, depositDecimals);
    if (rawShares === null) {
      setTxStatus({ type: "error", message: "Введите корректное количество share-токенов." });
      return;
    }
    await executeTx(`Вывод ${withdrawShares} share-токенов из Vault`, async () => {
      const tx = new Transaction();
      tx.add(buildWithdrawIx(publicKey, depositMint, rawShares));
      return tx;
    });
  };

  const handleAdminSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !vaultState || !strategy || !poolSummary) return;
    const aToB = swapDirection === "a_to_b";
    const inDecimals = aToB ? depositDecimals : secondaryDecimals;
    const outDecimals = aToB ? secondaryDecimals : depositDecimals;
    const amountInRaw = parseUiAmountToRaw(swapAmount, inDecimals);
    const minOutRaw = parseUiAmountToRaw(swapMinOut, outDecimals);
    if (amountInRaw === null || minOutRaw === null) {
      setTxStatus({ type: "error", message: "Введите корректные суммы для обмена и порога slippage." });
      return;
    }

    await executeTx(
      `CPI Swap через Raydium CLMM (${aToB ? "Deposit → Secondary" : "Secondary → Deposit"})`,
      async () => {
        const tx = new Transaction();
        tx.add(
          buildVaultSwapIx(
            publicKey,
            vaultState,
            strategy,
            poolSummary,
            amountInRaw,
            minOutRaw,
            aToB
          )
        );
        return tx;
      }
    );
  };

  const handleAdminCollectFees = async () => {
    if (!publicKey || !vaultState || !strategy || !poolSummary) return;
    await executeTx("Сбор комиссий CLMM-позиции (Collect Fees CPI)", async () => {
      const tx = new Transaction();
      tx.add(buildCollectFeesIx(publicKey, vaultState, strategy, poolSummary));
      return tx;
    });
  };

  const handleAdminClosePosition = async () => {
    if (!publicKey || !vaultState || !strategy || !poolSummary) return;
    await executeTx("Закрытие CLMM-позиции Vault (Close Position CPI)", async () => {
      const tx = new Transaction();
      tx.add(buildClosePositionIx(publicKey, vaultState, strategy, poolSummary, 0n, 0n));
      return tx;
    });
  };

  const shareExchangeRate =
    vaultState && vaultState.totalShares > 0n
      ? (Number(vaultPrimaryBalance) / Number(vaultState.totalShares)).toFixed(6)
      : "1.000000";

  const userPoolSharePct =
    vaultState && vaultState.totalShares > 0n && userShareBalance > 0n
      ? ((Number(userShareBalance) * 100) / Number(vaultState.totalShares)).toFixed(2)
      : "0.00";

  const isAdmin =
    publicKey && vaultState ? publicKey.equals(vaultState.admin) : false;

  const derivedVaultAddress = (() => {
    try {
      return deriveVaultPda(new PublicKey(mintInput.trim())).toBase58();
    } catch {
      return "—";
    }
  })();

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>Liquidity Vault — Raydium CLMM</h1>
          <p>
            Сквозной проект курса Solana (недели 8–14) · Хранилище ликвидности с долевыми
            токенами и концентрированной ликвидностью в Solana Devnet
          </p>
        </div>
        <div className="badge-row">
          <span className="pill-badge">Cluster: Solana Devnet</span>
          <WalletMultiButton />
        </div>
      </header>

      <section className="metrics-grid" aria-label="Ключевые показатели хранилища">
        <article className="metric-card">
          <div className="label">Ликвидность в Token Vault (Mint A)</div>
          <div className="value">
            {formatUiAmount(vaultPrimaryBalance, depositDecimals)}
          </div>
          <div className="sub">
            Выпущено долей: {formatUiAmount(vaultState?.totalShares ?? 0n, depositDecimals)}
          </div>
        </article>

        <article className="metric-card">
          <div className="label">Курс 1 Share → Deposit Token</div>
          <div className="value">{shareExchangeRate}</div>
          <div className="sub">
            Второй токен в Vault (Mint B):{" "}
            {formatUiAmount(vaultSecondaryBalance, secondaryDecimals)}
          </div>
        </article>

        <article className="metric-card">
          <div className="label">Ваша доля в пуле Vault</div>
          <div className="value">{userPoolSharePct}%</div>
          <div className="sub">
            Баланс shares: {formatUiAmount(userShareBalance, depositDecimals)} · Кошелёк:{" "}
            {formatUiAmount(userTokenBalance, depositDecimals)}
          </div>
        </article>

        <article className="metric-card">
          <div className="label">Цена в пуле Raydium CLMM</div>
          <div className="value">
            {poolSummary ? poolSummary.price.toFixed(6) : "—"}
          </div>
          <div className="sub">
            Текущий тик: {poolSummary ? poolSummary.tickCurrent : "—"} · Позиция:{" "}
            {strategy?.activePosition
              ? `[${strategy.tickLowerIndex}, ${strategy.tickUpperIndex}]`
              : "Нет активной"}
          </div>
        </article>
      </section>

      {txStatus.type !== "idle" && (
        <div
          role="alert"
          aria-live="polite"
          className={`status-alert ${
            txStatus.type === "error"
              ? "error"
              : txStatus.type === "success"
              ? "success"
              : ""
          }`}
          style={{ marginBottom: "1.5rem" }}
        >
          <div>{txStatus.message}</div>
          {txStatus.signature && (
            <div style={{ marginTop: "0.35rem" }}>
              <a
                className="mono-link"
                href={`https://explorer.solana.com/tx/${txStatus.signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Открыть транзакцию в Solana Explorer ({txStatus.signature.slice(0, 16)}...)
              </a>
            </div>
          )}
        </div>
      )}

      <div className="two-col">
        {/* Панель пользователя */}
        <section className="panel" aria-labelledby="user-panel-heading">
          <h2 id="user-panel-heading">Панель вкладчика (Deposit / Withdraw)</h2>
          <p className="panel-desc">
            Вносите токены в хранилище, получайте пропорциональные share-токены и выводите
            ликвидность вместе с накопленным доходом пула.
          </p>

          <div className="form-group">
            <label htmlFor="deposit-mint-input">Адрес токена депозита (Deposit Mint)</label>
            <input
              id="deposit-mint-input"
              type="text"
              value={mintInput}
              onChange={(e) => setMintInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-describedby="deposit-mint-hint"
            />
            <span id="deposit-mint-hint" className="field-hint">
              Vault PDA: <code>{derivedVaultAddress}</code>
            </span>
          </div>

          <form onSubmit={handleDeposit} className="form-group">
            <label htmlFor="deposit-amount-input">
              Сумма депозита (доступно: {formatUiAmount(userTokenBalance, depositDecimals)})
            </label>
            <input
              id="deposit-amount-input"
              type="text"
              inputMode="decimal"
              required
              pattern="^[0-9]+(\.[0-9]+)?$"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              aria-describedby="deposit-amount-hint"
            />
            <span id="deposit-amount-hint" className="field-hint">
              Если карточка пользователя (UserCard PDA) ещё не создана, она будет добавлена
              в транзакцию автоматически.
            </span>
            <div className="btn-row">
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !publicKey}
              >
                Внести в Vault (Deposit)
              </button>
              {!userCard && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isLoading || !publicKey}
                  onClick={handleCreateUserCard}
                >
                  Создать только UserCard
                </button>
              )}
            </div>
          </form>

          <form onSubmit={handleWithdraw} className="form-group">
            <label htmlFor="withdraw-shares-input">
              Количество share-токенов к сжиганию (доступно:{" "}
              {formatUiAmount(userShareBalance, depositDecimals)})
            </label>
            <input
              id="withdraw-shares-input"
              type="text"
              inputMode="decimal"
              required
              pattern="^[0-9]+(\.[0-9]+)?$"
              value={withdrawShares}
              onChange={(e) => setWithdrawShares(e.target.value)}
              aria-describedby="withdraw-shares-hint"
            />
            <span id="withdraw-shares-hint" className="field-hint">
              Вызывает CPI burn share-токенов и возврат базовых токенов за подписью Vault PDA.
            </span>
            <div className="btn-row">
              <button
                type="submit"
                className="btn-secondary"
                disabled={isLoading || !publicKey}
              >
                Вывести из Vault (Withdraw)
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isLoading}
                onClick={() => void refreshState()}
              >
                Обновить данные RPC
              </button>
            </div>
          </form>
        </section>

        {/* Панель администратора стратегии */}
        <section className="panel" aria-labelledby="admin-panel-heading">
          <h2 id="admin-panel-heading">
            Управление стратегией Raydium CLMM{" "}
            {isAdmin ? "(Вы — Admin)" : "(Только чтение / Admin Signer)"}
          </h2>
          <p className="panel-desc">
            Администратор хранилища управляет обменом токенов (CPI <code>swap_v2</code>),
            сбором накопленных комиссий и закрытием CLMM-позиции без доступа к выводу средств
            на личный кошелёк.
          </p>

          <div className="form-group">
            <label htmlFor="pool-address-input">Адрес пула Raydium CLMM (PoolState)</label>
            <input
              id="pool-address-input"
              type="text"
              value={poolInput}
              onChange={(e) => setPoolInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <form onSubmit={handleAdminSwap} className="form-group">
            <label htmlFor="swap-direction-select">Направление обмена Vault через CLMM</label>
            <select
              id="swap-direction-select"
              value={swapDirection}
              onChange={(e) =>
                setSwapDirection(e.target.value as "a_to_b" | "b_to_a")
              }
            >
              <option value="a_to_b">Deposit Mint (A) → Secondary Mint (B)</option>
              <option value="b_to_a">Secondary Mint (B) → Deposit Mint (A)</option>
            </select>

            <label htmlFor="swap-amount-input">Сумма входа (amount_in)</label>
            <input
              id="swap-amount-input"
              type="text"
              inputMode="decimal"
              required
              pattern="^[0-9]+(\.[0-9]+)?$"
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
            />

            <label htmlFor="swap-min-out-input">
              Минимум на выходе (min_amount_out, защита от slippage)
            </label>
            <input
              id="swap-min-out-input"
              type="text"
              inputMode="decimal"
              required
              pattern="^[0-9]+(\.[0-9]+)?$"
              value={swapMinOut}
              onChange={(e) => setSwapMinOut(e.target.value)}
              aria-describedby="swap-min-out-hint"
            />
            <span id="swap-min-out-hint" className="field-hint">
              Если пул вернёт меньше указанного порога, программа отклонит транзакцию с
              ошибкой <code>SlippageExceeded</code>.
            </span>

            <div className="btn-row">
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !publicKey || !strategy}
              >
                Выполнить Swap CPI
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isLoading || !publicKey || !strategy?.activePosition}
                onClick={handleAdminCollectFees}
              >
                Собрать комиссии (Collect Fees)
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={isLoading || !publicKey || !strategy?.activePosition}
                onClick={handleAdminClosePosition}
              >
                Закрыть позицию (Close Position)
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Адаптивная таблица ончейн-аккаунтов */}
      <section className="panel" aria-labelledby="accounts-table-heading">
        <h2 id="accounts-table-heading">Ончейн-аккаунты и PDA стенда (Solana Devnet)</h2>
        <p className="panel-desc">
          Все адреса вычисляются детерминированно через <code>findProgramAddressSync</code> и
          связаны с реальными аккаунтами в Solana Devnet.
        </p>

        <div className="table-scroll">
          <table data-responsive="true">
            <thead>
              <tr>
                <th scope="col">Сущность / Аккаунт</th>
                <th scope="col">Роль и Seeds</th>
                <th scope="col">Адрес в Devnet</th>
                <th scope="col">Статус / Значение</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" data-label="Сущность">
                  Liquidity Vault Program
                </th>
                <td data-label="Роль и Seeds">Anchor-программа хранилища</td>
                <td data-label="Адрес в Devnet">
                  <a
                    className="mono-link"
                    href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {PROGRAM_ID.toBase58()}
                  </a>
                </td>
                <td data-label="Статус">Развёрнута в Devnet</td>
              </tr>
              <tr>
                <th scope="row" data-label="Сущность">
                  VaultState PDA
                </th>
                <td data-label="Роль и Seeds">
                  <code>[&quot;vault&quot;, deposit_mint]</code>
                </td>
                <td data-label="Адрес в Devnet">
                  {vaultState ? (
                    <a
                      className="mono-link"
                      href={`https://explorer.solana.com/address/${vaultState.address.toBase58()}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {vaultState.address.toBase58()}
                    </a>
                  ) : (
                    derivedVaultAddress
                  )}
                </td>
                <td data-label="Статус">
                  {vaultState
                    ? `Активен (Shares: ${formatUiAmount(
                        vaultState.totalShares,
                        depositDecimals
                      )})`
                    : "Не инициализирован"}
                </td>
              </tr>
              <tr>
                <th scope="row" data-label="Сущность">
                  Share Mint PDA
                </th>
                <td data-label="Роль и Seeds">
                  <code>[&quot;share_mint&quot;, vault]</code>
                </td>
                <td data-label="Адрес в Devnet">
                  {vaultState ? (
                    <a
                      className="mono-link"
                      href={`https://explorer.solana.com/address/${vaultState.shareMint.toBase58()}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {vaultState.shareMint.toBase58()}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td data-label="Статус">Authority = VaultState PDA</td>
              </tr>
              <tr>
                <th scope="row" data-label="Сущность">
                  Strategy PDA
                </th>
                <td data-label="Роль и Seeds">
                  <code>[&quot;strategy&quot;, vault]</code>
                </td>
                <td data-label="Адрес в Devnet">
                  {strategy ? (
                    <a
                      className="mono-link"
                      href={`https://explorer.solana.com/address/${strategy.address.toBase58()}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {strategy.address.toBase58()}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td data-label="Статус">
                  {strategy
                    ? strategy.activePosition
                      ? `Активная позиция [${strategy.tickLowerIndex}, ${strategy.tickUpperIndex}]`
                      : "Привязана к пулу (без позиции)"
                    : "Не создана"}
                </td>
              </tr>
              <tr>
                <th scope="row" data-label="Сущность">
                  Raydium CLMM PoolState
                </th>
                <td data-label="Роль и Seeds">
                  Пул концентрированной ликвидности ({RAYDIUM_CLMM_DEVNET.toBase58().slice(0, 8)}…)
                </td>
                <td data-label="Адрес в Devnet">
                  <a
                    className="mono-link"
                    href={`https://explorer.solana.com/address/${poolInput.trim()}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {poolInput.trim()}
                  </a>
                </td>
                <td data-label="Статус">
                  {poolSummary
                    ? `Цена: ${poolSummary.price.toFixed(6)} (тик ${poolSummary.tickCurrent})`
                    : "Ожидание данных"}
                </td>
              </tr>
              <tr>
                <th scope="row" data-label="Сущность">
                  Secondary Token Mint
                </th>
                <td data-label="Роль и Seeds">Второй токен торговой пары CLMM</td>
                <td data-label="Адрес в Devnet">
                  <a
                    className="mono-link"
                    href={`https://explorer.solana.com/address/${(
                      strategy?.secondaryMint ?? DEVNET_SECONDARY_MINT
                    ).toBase58()}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {(strategy?.secondaryMint ?? DEVNET_SECONDARY_MINT).toBase58()}
                  </a>
                </td>
                <td data-label="Статус">
                  В хранилище: {formatUiAmount(vaultSecondaryBalance, secondaryDecimals)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

