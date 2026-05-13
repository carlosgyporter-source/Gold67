"use client";

import React, { useEffect, useMemo, useState } from "react";

type OpenTrade = {
  openTime: string;
  openPrice: number;
  investorsProfit: number;
};

type ManagedAccount = {
  id: string;
  name: string;
  mt5Username: string;
  mt5Password: string;
  server: string;
  netDeposits: number;
  netProfit: number;
  funds: number;
  openTradeProfit: number;
  positions: OpenTrade[];
  lastSyncedAt: string | null;
  syncState: "idle" | "saving" | "syncing" | "error";
  error?: string;
};

const STORAGE_KEY = "6ixseven-gold-accounts-v2";
const PIN_KEY = "6ixseven-gold-pin-v2";
const APP_NAME = "6ixSeven Gold";
const REFRESH_MS = 10 * 60 * 1000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const DEFAULT_SERVER = "PU Prime 6_MT5";

function money(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return `${n < 0 ? "-" : ""}£${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtTime(value: string | null) {
  if (!value) return "Not synced";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function makeBlankAccount(index: number): ManagedAccount {
  return {
    id: crypto.randomUUID(),
    name: `Account ${index}`,
    mt5Username: "",
    mt5Password: "",
    server: DEFAULT_SERVER,
    netDeposits: 0,
    netProfit: 0,
    funds: 0,
    openTradeProfit: 0,
    positions: [],
    lastSyncedAt: null,
    syncState: "idle",
  };
}

function accountWeight(account: ManagedAccount, percent: number, key: keyof Pick<ManagedAccount, "netDeposits" | "netProfit" | "funds" | "openTradeProfit">) {
  return (Number(account?.[key] || 0) * percent) / 100;
}

export default function Home() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"summary" | "trades" | "portal">("summary");
  const [refreshTick, setRefreshTick] = useState(0);
  const [accounts, setAccounts] = useState<ManagedAccount[]>([
    makeBlankAccount(1),
    makeBlankAccount(2),
    makeBlankAccount(3),
  ]);
  const [newAccountName, setNewAccountName] = useState("");

  useEffect(() => {
    const storedPin = localStorage.getItem(PIN_KEY);
    if (storedPin) setSavedPin(storedPin);

    const storedAccounts = localStorage.getItem(STORAGE_KEY);
    if (storedAccounts) {
      try {
        const parsed = JSON.parse(storedAccounts) as ManagedAccount[];
        if (Array.isArray(parsed) && parsed.length) {
          setAccounts(parsed);
        }
      } catch {
        // ignore bad storage
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshTick((x) => x + 1), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const c1 = accounts[0];
    const c2 = accounts[1];
    const c3 = accounts[2];

    return {
      carlos: {
        totalInvested: accountWeight(c1, 100, "netDeposits") + accountWeight(c2, 50, "netDeposits"),
        totalProfits: accountWeight(c1, 100, "netProfit") + accountWeight(c2, 50, "netProfit"),
        totalValue: accountWeight(c1, 100, "funds") + accountWeight(c2, 50, "funds"),
        currentTrades: accountWeight(c1, 100, "openTradeProfit") + accountWeight(c2, 50, "openTradeProfit"),
      },
      dale: {
        totalInvested: accountWeight(c3, 100, "netDeposits"),
        totalProfits: accountWeight(c3, 100, "netProfit"),
        totalValue: accountWeight(c3, 100, "funds"),
        currentTrades: accountWeight(c3, 100, "openTradeProfit"),
      },
    };
  }, [accounts, refreshTick]);

  async function savePin() {
    if (!pin.trim()) return;
    localStorage.setItem(PIN_KEY, pin.trim());
    setSavedPin(pin.trim());
    setIsAuthed(true);
  }

  function verifyPin() {
    if (!savedPin) {
      savePin();
      return;
    }
    if (pin.trim() === savedPin) {
      setIsAuthed(true);
    } else {
      alert("Wrong PIN");
    }
  }

  function updateAccount(id: string, patch: Partial<ManagedAccount>) {
    setAccounts((prev) => prev.map((acc) => (acc.id === id ? { ...acc, ...patch } : acc)));
  }

  function addAccount() {
    const nextIndex = accounts.length + 1;
    setAccounts((prev) => [...prev, makeBlankAccount(nextIndex)]);
  }

  function deleteAccount(id: string) {
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
  }

  async function syncAccount(account: ManagedAccount) {
    updateAccount(account.id, { syncState: "syncing", error: undefined });

    try {
      if (!API_BASE_URL) {
        updateAccount(account.id, {
          syncState: "idle",
          lastSyncedAt: new Date().toISOString(),
        });
        return;
      }

      const res = await fetch(`${API_BASE_URL}/sync-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: account.name,
          mt5Username: account.mt5Username,
          mt5Password: account.mt5Password,
          server: account.server,
        }),
      });

      if (!res.ok) throw new Error(`Sync failed (${res.status})`);

      const data = await res.json();
      updateAccount(account.id, {
        netDeposits: Number(data.netDeposits || 0),
        netProfit: Number(data.netProfit || 0),
        funds: Number(data.funds || 0),
        openTradeProfit: Number(data.openTradeProfit || 0),
        positions: Array.isArray(data.positions) ? data.positions : [],
        lastSyncedAt: new Date().toISOString(),
        syncState: "idle",
      });
    } catch (err) {
      updateAccount(account.id, {
        syncState: "error",
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }

  async function syncAll() {
    for (const account of accounts) {
      if (account.mt5Username.trim() || account.server.trim() || account.mt5Password.trim()) {
        // eslint-disable-next-line no-await-in-loop
        await syncAccount(account);
      }
    }
  }

  const openTrades = accounts[0]?.positions || [];

  if (!isAuthed) {
    return (
      <main style={styles.authShell}>
        <section style={styles.authCard}>
          <div style={styles.brandMark}>6</div>
          <h1 style={styles.h1}>6ixSeven Gold</h1>
          <p style={styles.mutedCenter}>App lock</p>

          <div style={styles.stack}>
            <Field label="Username" value={username} onChange={setUsername} placeholder="Username" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Password" />
            <Field label={savedPin ? "Enter PIN" : "Set PIN"} type="password" value={pin} onChange={setPin} placeholder="PIN" />

            <button style={styles.primaryBtn} onClick={verifyPin}>
              {savedPin ? "Unlock" : "Save PIN & Unlock"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <div>
          <div style={styles.brand}>{APP_NAME}</div>
          <div style={styles.subtle}>Portal login dashboard · refresh every 10 minutes</div>
        </div>

        <div style={styles.actions}>
          <button style={styles.ghostBtn} onClick={() => setRefreshTick((x) => x + 1)}>
            Refresh now
          </button>
          <button style={styles.primaryBtn} onClick={() => setTab("portal")}>Portal</button>
        </div>
      </header>

      <div style={styles.container}>
        <nav style={styles.tabs}>
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")} label="Summary" />
          <TabButton active={tab === "trades"} onClick={() => setTab("trades")} label="Current Open Trades" />
          <TabButton active={tab === "portal"} onClick={() => setTab("portal")} label="Portal" />
        </nav>

        {tab === "summary" && (
          <div style={styles.stack}>
            <section style={styles.panel}>
              <h2 style={styles.sectionTitle}>Carlos Investments</h2>
              <div style={styles.grid}>
                <Card title="Total Invested" value={money(summary.carlos.totalInvested)} />
                <Card title="Total Profits" value={money(summary.carlos.totalProfits)} accent />
                <Card title="Total Value" value={money(summary.carlos.totalValue)} />
                <Card title="Current Trades" value={money(summary.carlos.currentTrades)} accent />
              </div>
            </section>

            <section style={styles.panel}>
              <h2 style={styles.sectionTitle}>Dale Investment</h2>
              <div style={styles.grid}>
                <Card title="Total Invested" value={money(summary.dale.totalInvested)} />
                <Card title="Total Profits" value={money(summary.dale.totalProfits)} accent />
                <Card title="Total Value" value={money(summary.dale.totalValue)} />
                <Card title="Current Trades" value={money(summary.dale.currentTrades)} accent />
              </div>
            </section>
          </div>
        )}

        {tab === "trades" && (
          <section style={styles.panel}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Current Open Trades</h2>
                <p style={styles.subtle}>From Account 1</p>
              </div>
              <button style={styles.ghostBtn} onClick={() => syncAccount(accounts[0])}>
                Sync Account 1
              </button>
            </div>

            <div style={styles.tableHead}>
              <span>Open Time</span>
              <span>Open Price</span>
              <span>Investor Profit</span>
            </div>
            {openTrades.length === 0 ? (
              <div style={styles.emptyState}>No trades yet. Enter Account 1 portal details and sync.</div>
            ) : (
              openTrades.map((trade, idx) => (
                <div key={idx} style={styles.tableRow}>
                  <span>{trade.openTime}</span>
                  <span>{trade.openPrice.toFixed(5)}</span>
                  <span style={trade.investorsProfit >= 0 ? styles.positive : styles.negative}>{money(trade.investorsProfit)}</span>
                </div>
              ))
            )}
          </section>
        )}

        {tab === "portal" && (
          <section style={styles.panel}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Portal</h2>
                <p style={styles.subtle}>Enter the PAMM Account login details to pull data</p>
              </div>
              <button style={styles.primaryBtn} onClick={addAccount}>
                + Add Account
              </button>
            </div>

            <div style={styles.portalNote}>
              Account 1, Account 2, and Account 3 are already available. The server defaults to <strong>{DEFAULT_SERVER}</strong>. For live portal syncing, the backend should use the portal credentials you enter here.
            </div>

            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              {accounts.map((account) => (
                <div key={account.id} style={styles.accountCard}>
                  <div style={styles.accountHeader}>
                    <div>
                      <div style={styles.accountTitle}>{account.name}</div>
                      <div style={styles.subtle}>
                        {account.syncState === "syncing" ? "Syncing..." : account.syncState === "error" ? account.error || "Sync error" : `Last synced: ${fmtTime(account.lastSyncedAt)}`}
                      </div>
                    </div>
                    <button style={styles.deleteBtn} onClick={() => deleteAccount(account.id)}>
                      Delete
                    </button>
                  </div>

                  <div style={styles.grid3}>
                    <Field
                      label="Name"
                      value={account.name}
                      onChange={(value) => updateAccount(account.id, { name: value })}
                      placeholder="Account name"
                    />
                    <Field
                      label="PAMM Account"
                      value={account.mt5Username}
                      onChange={(value) => updateAccount(account.id, { mt5Username: value })}
                      placeholder="PAMM Account"
                    />
                    <Field
                      label="Password"
                      type="password"
                      value={account.mt5Password}
                      onChange={(value) => updateAccount(account.id, { mt5Password: value })}
                      placeholder="Password"
                    />
                    <Field
                      label="Server"
                      value={account.server}
                      onChange={(value) => updateAccount(account.id, { server: value || DEFAULT_SERVER })}
                      placeholder={DEFAULT_SERVER}
                    />
                  </div>

                  <div style={styles.accountButtons}>
                    <button style={styles.ghostBtn} onClick={() => syncAccount(account)}>
                      Sync Data
                    </button>
                    <div style={styles.smallStats}>
                      <span>Deposits: {money(account.netDeposits)}</span>
                      <span>Profit: {money(account.netProfit)}</span>
                      <span>Funds: {money(account.funds)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <button style={styles.primaryBtn} onClick={syncAll}>
                Sync All Accounts
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button style={active ? { ...styles.tab, ...styles.tabActive } : styles.tab} onClick={onClick}>
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </label>
  );
}

function Card({ title, value, accent = false }: { title: string; value: string; accent?: boolean }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{title}</div>
      <div style={accent ? { ...styles.cardValue, ...styles.accent } : styles.cardValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  authShell: {
    minHeight: "100vh",
    background: "#06070b",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    padding: 24,
  },
  authCard: {
    width: "100%",
    maxWidth: 480,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 28,
    padding: 28,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    background: "rgba(45,226,125,0.15)",
    color: "#2de27d",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    fontWeight: 800,
    margin: "0 auto 14px",
  },
  h1: { margin: 0, textAlign: "center", fontSize: 34 },
  mutedCenter: { textAlign: "center", color: "#9aa4b2", marginTop: 8 },
  page: { minHeight: "100vh", background: "#06070b", color: "#fff" },
  topbar: {
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.7)",
    padding: "18px 24px",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "center",
  },
  brand: { fontSize: 30, fontWeight: 800 },
  subtle: { color: "#9aa4b2", fontSize: 14 },
  actions: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  container: { maxWidth: 1200, margin: "0 auto", padding: 24 },
  tabs: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    padding: 10,
    borderRadius: 24,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    marginBottom: 18,
  },
  tab: {
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.03)",
    color: "#fff",
    borderRadius: 16,
    padding: "13px 20px",
    fontWeight: 700,
    cursor: "pointer",
  },
  tabActive: { background: "#2de27d", color: "#07110c", borderColor: "transparent" },
  primaryBtn: {
    border: "none",
    borderRadius: 16,
    background: "#2de27d",
    color: "#06110a",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  ghostBtn: {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  stack: { display: "grid", gap: 14 },
  panel: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: 18,
  },
  sectionTitle: { margin: 0, fontSize: 20 },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
  },
  grid: { display: "grid", gap: 14, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 14 },
  grid3: { display: "grid", gap: 14, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
  card: { background: "rgba(0,0,0,0.2)", borderRadius: 20, padding: 14 },
  cardLabel: { color: "#9aa4b2", fontSize: 12 },
  cardValue: { marginTop: 8, fontSize: 22, fontWeight: 800 },
  accent: { color: "#2de27d" },
  field: { display: "grid", gap: 8 },
  fieldLabel: { color: "rgba(255,255,255,0.72)", fontSize: 14 },
  input: {
    background: "rgba(0,0,0,0.3)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: "13px 14px",
    outline: "none",
  },
  portalNote: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#b8c1cc",
    fontSize: 13,
    lineHeight: 1.5,
  },
  accountCard: {
    background: "rgba(0,0,0,0.2)",
    borderRadius: 24,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  accountHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  accountTitle: { fontSize: 18, fontWeight: 800 },
  deleteBtn: {
    border: "1px solid rgba(255,124,124,0.3)",
    background: "rgba(255,124,124,0.1)",
    color: "#ffb2b2",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  accountButtons: {
    marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  smallStats: { display: "flex", gap: 14, flexWrap: "wrap", color: "#9aa4b2", fontSize: 13 },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    padding: "12px 14px",
    color: "#9aa4b2",
    fontWeight: 700,
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    marginTop: 14,
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  positive: { color: "#2de27d", fontWeight: 700 },
  negative: { color: "#ff7c7c", fontWeight: 700 },
  emptyState: {
    padding: 20,
    color: "#9aa4b2",
    background: "rgba(0,0,0,0.2)",
    borderRadius: 18,
    marginTop: 14,
  },
};
