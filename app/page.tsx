'use client';

import { useEffect, useMemo, useState } from 'react';

type Trade = {
  openTime: string;
  openPrice: number;
  investorsProfit: number;
};

type Investment = {
  id: string;
  name: string;
  percent: number;
  portalUser: string;
  portalPassword: string;
  portalServer: string;
  netDeposits: number;
  netProfit: number;
  funds: number;
  openTradeProfit: number;
  positions: Trade[];
};

const PORTAL_URL = 'https://pamm8.puprime.com/app/investments';
const REFRESH_MS = 10 * 60 * 1000;

const seedInvestments: Investment[] = [
  {
    id: '1',
    name: 'Carlos Investments',
    percent: 100,
    portalUser: '',
    portalPassword: '',
    portalServer: '',
    netDeposits: 3500,
    netProfit: 1882.68,
    funds: 5382.68,
    openTradeProfit: 1118.87,
    positions: [
      { openTime: '2026-05-13 08:41', openPrice: 1.0842, investorsProfit: 145.22 },
      { openTime: '2026-05-13 09:12', openPrice: 1.0829, investorsProfit: -18.5 },
      { openTime: '2026-05-13 10:03', openPrice: 1.0851, investorsProfit: 991.1 },
    ],
  },
  {
    id: '2',
    name: 'Dale Investment',
    percent: 100,
    portalUser: '',
    portalPassword: '',
    portalServer: '',
    netDeposits: 12000,
    netProfit: 2344.2,
    funds: 14344.2,
    openTradeProfit: 211.44,
    positions: [
      { openTime: '2026-05-13 07:55', openPrice: 1.0831, investorsProfit: 54.22 },
      { openTime: '2026-05-13 10:40', openPrice: 1.0814, investorsProfit: 157.22 },
    ],
  },
  {
    id: '3',
    name: 'Account 3',
    percent: 100,
    portalUser: '',
    portalPassword: '',
    portalServer: '',
    netDeposits: 0,
    netProfit: 0,
    funds: 0,
    openTradeProfit: 0,
    positions: [],
  },
];

function money(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Card({ title, value, accent = false }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className="card">
      <div className="cardLabel">{title}</div>
      <div className={`cardValue ${accent ? 'accent' : ''}`}>{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="field">
      <div className="fieldLabel">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </label>
  );
}

export default function Home() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTab, setSelectedTab] = useState<'summary' | 'trades' | 'portal'>('summary');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [investments, setInvestments] = useState(seedInvestments);
  const [showAdd, setShowAdd] = useState(false);
  const [newInv, setNewInv] = useState({ name: '', percent: '' });
  const [portalForm, setPortalForm] = useState({ user: '', password: '', server: '' });

  useEffect(() => {
    const timer = window.setInterval(() => setLastRefresh(new Date()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const c1 = investments[0];
    const c2 = investments[1];
    const c3 = investments[2];

    const weight = (item: Investment, key: keyof Investment) =>
      (Number(item?.[key] || 0) * Number(item?.percent || 0)) / 100;

    return {
      carlos: {
        totalInvested: weight(c1, 'netDeposits') + 0.5 * weight(c2, 'netDeposits'),
        totalProfits: weight(c1, 'netProfit') + 0.5 * weight(c2, 'netProfit'),
        totalValue: weight(c1, 'funds') + 0.5 * weight(c2, 'funds'),
        currentTrades: weight(c1, 'openTradeProfit') + 0.5 * weight(c2, 'openTradeProfit'),
      },
      dale: {
        totalInvested: weight(c3, 'netDeposits'),
        totalProfits: weight(c3, 'netProfit'),
        totalValue: weight(c3, 'funds'),
        currentTrades: weight(c3, 'openTradeProfit'),
      },
    };
  }, [investments]);

  const account1Trades = investments[0].positions;

  const addInvestment = () => {
    if (!newInv.name.trim() || !newInv.percent.trim()) return;
    setInvestments((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: newInv.name.trim(),
        percent: Number(newInv.percent) || 0,
        portalUser: '',
        portalPassword: '',
        portalServer: '',
        netDeposits: 0,
        netProfit: 0,
        funds: 0,
        openTradeProfit: 0,
        positions: [],
      },
    ]);
    setNewInv({ name: '', percent: '' });
    setShowAdd(false);
  };

  if (!isAuthed) {
    return (
      <main className="authShell">
        <section className="authCard">
          <div className="brandMark">6</div>
          <h1>6ixSeven Gold</h1>
          <p>Web dashboard login</p>
          <div className="stack">
            <Field label="Username" value={username} onChange={setUsername} placeholder="Enter dashboard username" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter dashboard password" />
            <button
              className="primaryBtn"
              onClick={() => {
                if (username.trim() && password.trim()) setIsAuthed(true);
              }}
            >
              Sign In
            </button>
          </div>
          <div className="note">
            This version runs in the browser. The portal integration can be connected through a secure backend later.
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="brand">6ixSeven Gold</div>
          <div className="subtle">Web-based dashboard · auto refresh every 10 minutes</div>
        </div>
        <div className="actions">
          <span className="pill">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          <button className="ghostBtn" onClick={() => setLastRefresh(new Date())}>
            Refresh now
          </button>
          <button className="primaryBtn" onClick={() => setShowAdd(true)}>
            + Add Investment
          </button>
        </div>
      </header>

      <div className="container">
        <nav className="tabs">
          <button className={`tab ${selectedTab === 'summary' ? 'active' : ''}`} onClick={() => setSelectedTab('summary')}>
            Summary
          </button>
          <button className={`tab ${selectedTab === 'trades' ? 'active' : ''}`} onClick={() => setSelectedTab('trades')}>
            Current Open Trades
          </button>
          <button className={`tab ${selectedTab === 'portal' ? 'active' : ''}`} onClick={() => setSelectedTab('portal')}>
            Portal
          </button>
        </nav>

        {selectedTab === 'summary' && (
          <section className="stack">
            <section>
              <h2>Carlos Investments</h2>
              <div className="grid">
                <Card title="Total Invested" value={money(summary.carlos.totalInvested)} />
                <Card title="Total Profits" value={money(summary.carlos.totalProfits)} accent />
                <Card title="Total Value" value={money(summary.carlos.totalValue)} />
                <Card title="Current Trades" value={money(summary.carlos.currentTrades)} accent />
              </div>
            </section>

            <section>
              <h2>Dale Investment</h2>
              <div className="grid">
                <Card title="Total Invested" value={money(summary.dale.totalInvested)} />
                <Card title="Total Profits" value={money(summary.dale.totalProfits)} accent />
                <Card title="Total Value" value={money(summary.dale.totalValue)} />
                <Card title="Current Trades" value={money(summary.dale.currentTrades)} accent />
              </div>
            </section>

            <section>
              <h2>Added Accounts</h2>
              <div className="stack">
                {investments.map((inv) => (
                  <div key={inv.id} className="panel">
                    <div className="panelTitle">{inv.name}</div>
                    <div className="subtle">{inv.percent}% of investment</div>
                  </div>
                ))}
              </div>
            </section>
          </section>
        )}

        {selectedTab === 'trades' && (
          <section className="panel">
            <div className="sectionHeader">
              <div>
                <h2>Current Open Trades</h2>
                <p>Open positions from account 1</p>
              </div>
              <div className="subtle">{account1Trades.length} trades</div>
            </div>

            <div className="table">
              <div className="tableHead">
                <span>Open Time</span>
                <span>Open Price</span>
                <span>Investor Profit</span>
              </div>
              {account1Trades.map((trade, idx) => (
                <div key={idx} className="tableRow">
                  <span>{trade.openTime}</span>
                  <span>{trade.openPrice.toFixed(5)}</span>
                  <span className={trade.investorsProfit >= 0 ? 'positive' : 'negative'}>
                    {money(trade.investorsProfit)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {selectedTab === 'portal' && (
          <section className="panel">
            <div className="sectionHeader">
              <div>
                <h2>Portal access</h2>
                <p>This web app can be connected to a backend later for live extraction.</p>
              </div>
              <a className="ghostBtn linkBtn" href={PORTAL_URL} target="_blank" rel="noreferrer">
                Open Portal
              </a>
            </div>

            <div className="grid3">
              <Field label="Portal Username" value={portalForm.user} onChange={(v) => setPortalForm((p) => ({ ...p, user: v }))} placeholder="Username" />
              <Field label="Portal Password" type="password" value={portalForm.password} onChange={(v) => setPortalForm((p) => ({ ...p, password: v }))} placeholder="Password" />
              <Field label="Portal Server" value={portalForm.server} onChange={(v) => setPortalForm((p) => ({ ...p, server: v }))} placeholder="Server" />
            </div>

            <div className="portalFrame">
              <iframe title="PU Prime Portal" src={PORTAL_URL} />
            </div>
          </section>
        )}
      </div>

      {showAdd && (
        <div className="modalBack">
          <div className="modalCard">
            <div className="sectionHeader">
              <div>
                <h3>Add Investment</h3>
                <p>Add another account with a percentage allocation.</p>
              </div>
              <button className="ghostBtn" onClick={() => setShowAdd(false)}>
                ✕
              </button>
            </div>

            <div className="stack">
              <Field label="Name" value={newInv.name} onChange={(v) => setNewInv((p) => ({ ...p, name: v }))} placeholder="Account name" />
              <Field label="% Of Investment" value={newInv.percent} onChange={(v) => setNewInv((p) => ({ ...p, percent: v }))} placeholder="25" />
            </div>

            <div className="actions">
              <button className="ghostBtn" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="primaryBtn" onClick={addInvestment}>
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
