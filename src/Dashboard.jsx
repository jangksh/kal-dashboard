import { useState, useMemo } from "react";
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#06080e", surface: "#0b0f1a", card: "#0f1520",
  border: "#1a2235", borderAccent: "#243044",
  primary: "#0033A0", primaryLight: "#1a4fc4", primaryGlow: "rgba(0,51,160,0.3)",
  cyan: "#00d4ff",    cyanDim:    "rgba(0,212,255,0.12)",
  gold: "#f5c518",    goldDim:    "rgba(245,197,24,0.12)",
  green: "#00e5a0",   greenDim:   "rgba(0,229,160,0.12)",
  red: "#ff4d6a",     redDim:     "rgba(255,77,106,0.12)",
  amber: "#ffb347",   amberDim:   "rgba(255,179,71,0.12)",
  forecast: "#b48fff",forecastDim:"rgba(180,143,255,0.12)",
  t1: "#f0f4ff", t2: "#c8d3e8", t3: "#8896b0", t4: "#4f5f78",
};

// ─── ALL MONTHS 2020-01 ~ 2027-12 ────────────────────────────────────────────
const ALL_MONTHS = (() => {
  const out = [];
  for (let yr = 2020; yr <= 2027; yr++)
    for (let mo = 1; mo <= 12; mo++)
      out.push(`${String(yr).slice(2)}-${String(mo).padStart(2,"0")}`);
  return out;
})();

const HIST_END_IDX = ALL_MONTHS.indexOf("26-03");

// ─── SEEDED DETERMINISTIC DATA ───────────────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const DATA_MAP = (() => {
  const rand = seededRand(42);
  const map  = {};
  ALL_MONTHS.forEach((m, i) => {
    const yr = Math.floor(i / 12), mo = i % 12;
    const isForecast = i > HIST_END_IDX;
    const covid  = yr === 0 ? 0.35 : yr === 1 ? 0.55 : 1;
    const sP     = 1 + 0.22 * Math.sin((mo - 5) * Math.PI / 6);
    const sC     = 1 + 0.12 * Math.sin((mo - 2) * Math.PI / 6);
    const gP     = Math.pow(1.08, yr + mo / 12);
    const gC     = Math.pow(1.05, yr + mo / 12);
    const gO     = Math.pow(1.04, yr + mo / 12);
    const n      = () => 1 + (rand() - 0.5) * (isForecast ? 0.04 : 0.08);
    const pax    = Math.max(0, 28 * covid * sP * gP * n());
    const cargo  = Math.max(0, 18 * covid * sC * gC * n());
    const opex   = Math.max(0, 12 * covid * (1 + 0.08*Math.sin((mo-3)*Math.PI/6)) * gO * n());
    const remit  = (pax + cargo - opex) * 0.72;
    const ar     = pax * 0.62 * n();
    const dso    = 28 + rand() * 8 - (i > 50 ? 3 : 0);
    const abs    = Math.max(0, 85 - i * 1.1);
    map[m] = {
      month: m, idx: i, isForecast, pax, cargo, opex, remit, ar, dso, abs,
      byScenario: {
        Base:        { pax,             cargo,             opex,             remit,             ar },
        Optimistic:  { pax:pax*1.13,    cargo:cargo*1.09,  opex:opex*0.97,   remit:(pax*1.13+cargo*1.09-opex*0.97)*0.72,   ar:ar*1.05 },
        Pessimistic: { pax:pax*0.88,    cargo:cargo*0.92,  opex:opex*1.06,   remit:(pax*0.88+cargo*0.92-opex*1.06)*0.72,   ar:ar*0.93 },
      },
    };
  });
  return map;
})();

// ─── TIMELINE EVENTS ─────────────────────────────────────────────────────────
const TIMELINE_EVENTS = [
  { month:"20-02", label:"COVID-19 여객 급락",       type:"risk" },
  { month:"21-06", label:"화물 수요 급증",            type:"opportunity" },
  { month:"22-04", label:"국제선 전면 재개",          type:"milestone" },
  { month:"23-08", label:"체리 Charter 최대 실적",    type:"opportunity" },
  { month:"24-03", label:"TOT 환급 $887K",           type:"cash" },
  { month:"25-03", label:"ABS 만기 상환 완료",        type:"milestone" },
  { month:"26-06", label:"신규 FWDR 계약 (예정)",     type:"forecast" },
  { month:"26-12", label:"터미널 공사 완료 (예정)",   type:"forecast" },
];
const EV_COLOR = { risk:T.red, opportunity:T.green, milestone:T.cyan, cash:T.gold, forecast:T.forecast };

// ─── PRESET PERIODS ──────────────────────────────────────────────────────────
// anchor = end month (inclusive). start is computed from end.
const PRESETS = [
  { id:"1M",   label:"1개월",   months:1  },
  { id:"3M",   label:"3개월",   months:3  },
  { id:"6M",   label:"6개월",   months:6  },
  { id:"1Y",   label:"1년",     months:12 },
  { id:"2Y",   label:"2년",     months:24 },
  { id:"3Y",   label:"3년",     months:36 },
  { id:"5Y",   label:"5년",     months:60 },
  { id:"ALL",  label:"전체",    months:null },
  { id:"CUSTOM",label:"직접 설정", months:"custom" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const $m  = (v, d=1) => v == null ? "—" : `$${(+v).toFixed(d)}M`;
const pct = (v) => `${+v >= 0 ? "+" : ""}${(+v).toFixed(1)}%`;
const monthLabel = (m) => {
  if (!m) return "";
  const [yy, mm] = m.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `20${yy}. ${names[+mm-1]}`;
};
// Returns subset of ALL_MONTHS given [startM, endM] inclusive
function monthsInRange(startM, endM) {
  const si = ALL_MONTHS.indexOf(startM), ei = ALL_MONTHS.indexOf(endM);
  if (si < 0 || ei < 0 || si > ei) return [];
  return ALL_MONTHS.slice(si, ei + 1);
}
// Given endMonth + count, compute startMonth
function startFromEnd(endM, count) {
  const ei = ALL_MONTHS.indexOf(endM);
  if (ei < 0) return ALL_MONTHS[0];
  return ALL_MONTHS[Math.max(0, ei - count + 1)];
}
// Accumulate a field over an array of month keys
function accum(keys, field, scenario) {
  return keys.reduce((s, m) => {
    const d = DATA_MAP[m];
    if (!d) return s;
    return s + (d.byScenario[scenario]?.[field] ?? d[field] ?? 0);
  }, 0);
}
// Period YoY: same length period ending 1 year earlier
function periodYoY(keys, field, scenario) {
  const shifted = keys.map(m => {
    const [yy, mm] = m.split("-");
    const prevYY = String(+("20"+yy) - 1).slice(2);
    return `${prevYY}-${mm}`;
  });
  const cur  = accum(keys,    field, scenario);
  const prev = accum(shifted, field, scenario);
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

// ─── MICRO COMPONENTS ────────────────────────────────────────────────────────
function Badge({ label, color = T.cyan }) {
  return (
    <span style={{
      fontSize:10, fontWeight:700, letterSpacing:1, padding:"2px 8px",
      borderRadius:3, border:`1px solid ${color}40`, color, background:`${color}15`,
      textTransform:"uppercase", whiteSpace:"nowrap",
    }}>{label}</span>
  );
}

function SH({ icon, title, sub }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
        <span style={{ fontSize:15 }}>{icon}</span>
        <span style={{ fontSize:13, fontWeight:800, color:T.t1 }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize:10, color:T.t4, marginTop:2, marginLeft:22 }}>{sub}</div>}
    </div>
  );
}

function Divider() { return <div style={{ height:1, background:T.border, margin:"10px 0" }} />; }

function StatRow({ label, value, color=T.t2, sub }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
      padding:"5px 0", borderBottom:`1px solid ${T.border}40` }}>
      <span style={{ fontSize:11, color:T.t4 }}>{label}</span>
      <div style={{ textAlign:"right" }}>
        <span style={{ fontSize:12, color, fontWeight:700, fontFamily:"monospace" }}>{value}</span>
        {sub && <span style={{ fontSize:10, color:T.t4, marginLeft:5 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── PERIOD RANGE SELECTOR BAR ────────────────────────────────────────────────
// Shows: [preset buttons] [End month picker: year+month] [Custom start picker]
function PeriodBar({ rangeStart, rangeEnd, preset, onPresetChange, onRangeChange }) {
  const years  = ["2020","2021","2022","2023","2024","2025","2026","2027"];
  const moNames = ["01","02","03","04","05","06","07","08","09","10","11","12"];

  const [endYY, endMM] = rangeEnd ? rangeEnd.split("-") : ["26","03"];
  const [stYY, stMM]   = rangeStart ? rangeStart.split("-") : ["20","01"];

  const handleEndYear = (yr) => {
    const yy = String(yr).slice(2);
    const newEnd = `${yy}-${endMM}`;
    if (!ALL_MONTHS.includes(newEnd)) return;
    // recompute start from preset
    if (preset !== "CUSTOM" && preset !== "ALL") {
      const p = PRESETS.find(p=>p.id===preset);
      const newStart = p ? startFromEnd(newEnd, p.months) : ALL_MONTHS[0];
      onRangeChange(newStart, newEnd);
    } else if (preset === "ALL") {
      onRangeChange(ALL_MONTHS[0], newEnd);
    } else {
      onRangeChange(rangeStart, newEnd);
    }
  };
  const handleEndMonth = (mm) => {
    const newEnd = `${endYY}-${mm}`;
    if (!ALL_MONTHS.includes(newEnd)) return;
    if (preset !== "CUSTOM" && preset !== "ALL") {
      const p = PRESETS.find(p=>p.id===preset);
      const newStart = p ? startFromEnd(newEnd, p.months) : ALL_MONTHS[0];
      onRangeChange(newStart, newEnd);
    } else if (preset === "ALL") {
      onRangeChange(ALL_MONTHS[0], newEnd);
    } else {
      onRangeChange(rangeStart, newEnd);
    }
  };
  const handleStartYear = (yr) => {
    const yy = String(yr).slice(2);
    const newStart = `${yy}-${stMM}`;
    if (ALL_MONTHS.includes(newStart)) onRangeChange(newStart, rangeEnd);
  };
  const handleStartMonth = (mm) => {
    const newStart = `${stYY}-${mm}`;
    if (ALL_MONTHS.includes(newStart) && ALL_MONTHS.indexOf(newStart) <= ALL_MONTHS.indexOf(rangeEnd))
      onRangeChange(newStart, rangeEnd);
  };

  const btnStyle = (active, color=T.cyan) => ({
    padding:"4px 10px", borderRadius:5, border:`1px solid ${active?color:T.border}`,
    background:active?`${color}22`:"transparent", color:active?color:T.t3,
    fontSize:10, fontWeight:700, cursor:"pointer", transition:"all 0.15s", whiteSpace:"nowrap",
  });
  const miniBtn = (active) => ({
    padding:"3px 6px", borderRadius:4, border:`1px solid ${active?T.gold:T.border}`,
    background:active?`${T.gold}22`:"transparent", color:active?T.gold:T.t3,
    fontSize:9, fontWeight:600, cursor:"pointer", transition:"all 0.12s",
  });

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:6, flexWrap:"wrap",
      background:T.card, borderRadius:8, padding:"10px 14px",
      border:`1px solid ${T.borderAccent}`,
      boxShadow:`0 0 0 1px ${T.primaryGlow}`,
    }}>
      {/* ── 기간 라벨 */}
      <span style={{ fontSize:10, color:T.t4, fontWeight:700, letterSpacing:0.8, marginRight:4 }}>
        📐 누적 기간
      </span>

      {/* ── Preset buttons */}
      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
        {PRESETS.map(p => (
          <button key={p.id}
            onClick={() => onPresetChange(p.id)}
            style={btnStyle(preset===p.id, p.id==="CUSTOM"?T.forecast:T.cyan)}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ width:1, height:28, background:T.border, margin:"0 4px" }} />

      {/* ── End month (anchor) */}
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <span style={{ fontSize:9, color:T.t4, whiteSpace:"nowrap" }}>종료월</span>
        {/* Year */}
        <div style={{ display:"flex", gap:2 }}>
          {years.map(yr => (
            <button key={yr} onClick={()=>handleEndYear(yr)}
              style={miniBtn("20"+endYY===yr)}>{yr.slice(2)}</button>
          ))}
        </div>
        {/* Month */}
        <div style={{ display:"flex", gap:2 }}>
          {moNames.map(mm => {
            const k = `${endYY}-${mm}`;
            const valid = ALL_MONTHS.includes(k);
            return (
              <button key={mm} onClick={()=>valid&&handleEndMonth(mm)} disabled={!valid}
                style={{ ...miniBtn(endMM===mm), opacity:valid?1:0.3 }}>{mm}</button>
            );
          })}
        </div>
      </div>

      {/* ── Custom start month (only when CUSTOM) */}
      {preset === "CUSTOM" && (
        <>
          <div style={{ width:1, height:28, background:T.border, margin:"0 4px" }} />
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:9, color:T.forecast, whiteSpace:"nowrap" }}>시작월</span>
            <div style={{ display:"flex", gap:2 }}>
              {years.map(yr => (
                <button key={yr} onClick={()=>handleStartYear(yr)}
                  style={{ ...miniBtn("20"+stYY===yr), borderColor:"20"+stYY===yr?T.forecast:T.border,
                    background:"20"+stYY===yr?`${T.forecast}22`:"transparent",
                    color:"20"+stYY===yr?T.forecast:T.t3 }}>{yr.slice(2)}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:2 }}>
              {moNames.map(mm => {
                const k = `${stYY}-${mm}`;
                const valid = ALL_MONTHS.includes(k) && ALL_MONTHS.indexOf(k)<=ALL_MONTHS.indexOf(rangeEnd);
                return (
                  <button key={mm} onClick={()=>valid&&handleStartMonth(mm)} disabled={!valid}
                    style={{ ...miniBtn(stMM===mm), opacity:valid?1:0.3,
                      borderColor:stMM===mm?T.forecast:T.border,
                      background:stMM===mm?`${T.forecast}22`:"transparent",
                      color:stMM===mm?T.forecast:T.t3 }}>{mm}</button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Active range display */}
      <div style={{ marginLeft:"auto", fontSize:11, color:T.gold, fontWeight:700,
        fontFamily:"monospace", whiteSpace:"nowrap", letterSpacing:0.5 }}>
        {monthLabel(rangeStart)} → {monthLabel(rangeEnd)}
      </div>
    </div>
  );
}

// ─── KPI CARD (with period-accumulated values) ───────────────────────────────
function KpiCard({ icon, title, val, sub, yoy, color=T.cyan, alert=false, tag }) {
  const dy = yoy != null ? +yoy : null;
  return (
    <div style={{
      background:T.card, borderRadius:8, padding:"15px 17px",
      border:`1px solid ${alert?T.red:T.border}`,
      borderTop:`2px solid ${alert?T.red:color}`,
      boxShadow:alert?`0 0 16px ${T.redDim}`:"none",
      position:"relative", overflow:"hidden",
    }}>
      {alert && <div style={{ position:"absolute", top:9, right:9, width:7, height:7,
        borderRadius:"50%", background:T.red, animation:"pulse 1.4s infinite" }} />}
      <div style={{ fontSize:10, color:T.t4, letterSpacing:0.7, marginBottom:5, textTransform:"uppercase" }}>
        {icon} {title}
      </div>
      <div style={{ fontSize:20, fontWeight:800, color:T.t1, fontFamily:"monospace", letterSpacing:-0.5 }}>{val}</div>
      <div style={{ fontSize:10, color:T.t4, marginTop:2, minHeight:14 }}>{sub}</div>
      {dy != null && (
        <div style={{ fontSize:10, color:dy>0?T.green:dy<0?T.red:T.t3, marginTop:4, fontWeight:600 }}>
          {pct(dy)} <span style={{ color:T.t4, fontWeight:400 }}>YoY</span>
        </div>
      )}
      {tag && (
        <div style={{ position:"absolute", bottom:8, right:10 }}>
          <Badge label={tag} color={color} />
        </div>
      )}
    </div>
  );
}

// ─── CHART TOOLTIP ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0a0f1cee", border:`1px solid ${T.borderAccent}`,
      borderRadius:8, padding:"11px 15px", fontSize:11, backdropFilter:"blur(8px)", minWidth:150 }}>
      <div style={{ color:T.t3, marginBottom:7, fontWeight:700 }}>{monthLabel(label)}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:14, marginTop:3 }}>
          <span style={{ color:T.t4 }}>{p.name}</span>
          <span style={{ color:p.color, fontWeight:700 }}>
            {typeof p.value==="number" ? `$${p.value.toFixed(2)}M` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── CASH RUNWAY GAUGE ───────────────────────────────────────────────────────
function CashRunwayGauge({ scenario }) {
  const vals = { Base:8.3, Optimistic:14.1, Pessimistic:5.1 };
  const val  = vals[scenario];
  const MAX  = 18;
  const color= val > 9 ? T.green : val > 6 ? T.amber : T.red;
  const R=72, CX=100, CY=96;
  const toRad = d => d*Math.PI/180;
  const arc = (deg) => ({ x: CX+R*Math.cos(toRad(deg)), y: CY+R*Math.sin(toRad(deg)) });
  const startDeg=-220, sweepDeg=260;
  const fillDeg=(val/MAX)*sweepDeg;
  const bgEnd=arc(startDeg+sweepDeg), bgSt=arc(startDeg);
  const filEnd=arc(startDeg+fillDeg);
  const lg=(d)=>d>180?1:0;
  const ndl=arc(startDeg+fillDeg);
  const ticks=[0,3,6,9,12,15,18];
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px 18px" }}>
      <div style={{ fontSize:10, color:T.t3, letterSpacing:0.8, marginBottom:2, textTransform:"uppercase", fontWeight:700 }}>
        💧 Cash Runway
      </div>
      <svg viewBox="0 0 200 120" style={{ width:"100%", overflow:"visible" }}>
        <path d={`M${bgSt.x} ${bgSt.y} A${R} ${R} 0 ${lg(sweepDeg)} 1 ${bgEnd.x} ${bgEnd.y}`}
          fill="none" stroke={T.border} strokeWidth="14" strokeLinecap="round"/>
        {fillDeg>1&&<path d={`M${bgSt.x} ${bgSt.y} A${R} ${R} 0 ${lg(fillDeg)} 1 ${filEnd.x} ${filEnd.y}`}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 5px ${color})`,transition:"all 0.7s ease"}}/>}
        {ticks.map(t=>{
          const d=startDeg+(t/MAX)*sweepDeg;
          const inn={x:CX+(R-10)*Math.cos(toRad(d)),y:CY+(R-10)*Math.sin(toRad(d))};
          const out={x:CX+(R-2 )*Math.cos(toRad(d)),y:CY+(R-2 )*Math.sin(toRad(d))};
          const lb ={x:CX+(R-22)*Math.cos(toRad(d)),y:CY+(R-22)*Math.sin(toRad(d))};
          return <g key={t}>
            <line x1={inn.x} y1={inn.y} x2={out.x} y2={out.y} stroke={T.borderAccent} strokeWidth={t%6===0?2:1}/>
            {t%6===0&&<text x={lb.x} y={lb.y+1} textAnchor="middle" dominantBaseline="middle" fill={T.t4} fontSize="8">{t}</text>}
          </g>;
        })}
        <line x1={CX} y1={CY}
          x2={CX+(R-18)*Math.cos(toRad(startDeg+fillDeg))}
          y2={CY+(R-18)*Math.sin(toRad(startDeg+fillDeg))}
          stroke={color} strokeWidth="2.5" strokeLinecap="round"
          style={{transition:"all 0.7s ease",filter:`drop-shadow(0 0 4px ${color})`}}/>
        <circle cx={CX} cy={CY} r="5" fill={color} style={{filter:`drop-shadow(0 0 5px ${color})`}}/>
        <text x={CX} y={CY+18} textAnchor="middle" fill={color} fontSize="20" fontWeight="900" fontFamily="monospace"
          style={{transition:"all 0.7s ease"}}>{val.toFixed(1)}</text>
        <text x={CX} y={CY+31} textAnchor="middle" fill={T.t4} fontSize="9">개월</text>
        <text x="28"  y="112" textAnchor="middle" fill={T.red}   fontSize="8">위기</text>
        <text x="100" y="26"  textAnchor="middle" fill={T.amber} fontSize="8">주의</text>
        <text x="172" y="112" textAnchor="middle" fill={T.green} fontSize="8">안정</text>
      </svg>
      <div style={{ textAlign:"center", fontSize:10, color, fontWeight:600, marginTop:0 }}>
        {val<5?"🔴 즉시 조치":val<7?"🟡 주의 모니터링":val<10?"🟢 안정":"✅ 우수"}
      </div>
      <Divider/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4 }}>
        {[{s:"Pessimistic",v:5.1,c:T.red},{s:"Base",v:8.3,c:T.amber},{s:"Optimistic",v:14.1,c:T.green}].map(it=>(
          <div key={it.s} style={{ textAlign:"center", padding:"4px",
            background:scenario===it.s?`${it.c}18`:"transparent",
            border:`1px solid ${scenario===it.s?it.c:T.border}`, borderRadius:5 }}>
            <div style={{ fontSize:8, color:T.t4 }}>{it.s.slice(0,4)}</div>
            <div style={{ fontSize:11, color:it.c, fontWeight:700, fontFamily:"monospace" }}>{it.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DATE PICKER PANEL (for deep-dive) ───────────────────────────────────────
function DatePickerPanel({ selectedMonth, onSelect, onClear }) {
  const years   = ["2020","2021","2022","2023","2024","2025","2026","2027"];
  const moNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [selYY, setSelYY] = useState(selectedMonth ? "20"+selectedMonth.split("-")[0] : "2024");
  const key = (yr,i) => `${String(yr).slice(2)}-${String(i+1).padStart(2,"0")}`;
  return (
    <div style={{ background:T.card, border:`1px solid ${T.borderAccent}`, borderRadius:10, padding:"16px 18px" }}>
      <div style={{ fontSize:10, color:T.t3, letterSpacing:0.8, marginBottom:12, textTransform:"uppercase", fontWeight:700 }}>
        📅 날짜 선택 (Deep-dive)
      </div>
      <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginBottom:10 }}>
        {years.map(yr=>(
          <button key={yr} onClick={()=>setSelYY(yr)} style={{
            padding:"3px 8px", borderRadius:4, border:`1px solid ${selYY===yr?T.cyan:T.border}`,
            background:selYY===yr?T.cyanDim:"transparent",
            color:selYY===yr?T.cyan:T.t3, fontSize:10, fontWeight:600, cursor:"pointer" }}>
            {yr}
          </button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4 }}>
        {moNames.map((mo,i)=>{
          const k   = key(selYY, i);
          const ok  = ALL_MONTHS.includes(k);
          const sel = selectedMonth===k;
          const fc  = ALL_MONTHS.indexOf(k) > HIST_END_IDX;
          const ev  = TIMELINE_EVENTS.some(e=>e.month===k);
          return (
            <button key={mo} disabled={!ok} onClick={()=>ok&&onSelect(k)} style={{
              padding:"7px 3px", borderRadius:5, fontSize:10, cursor:ok?"pointer":"default",
              border:`1px solid ${sel?T.cyan:ev?`${T.gold}60`:T.border}`,
              background:sel?T.cyanDim:ev?`${T.gold}10`:"transparent",
              color:!ok?T.t4:sel?T.cyan:fc?T.forecast:T.t2,
              fontWeight:sel?700:400, position:"relative" }}>
              {mo}
              {ev&&<span style={{ position:"absolute",top:2,right:2,width:4,height:4,
                borderRadius:"50%",background:T.gold }}/>}
              {fc&&!sel&&<span style={{ position:"absolute",bottom:1,left:"50%",
                transform:"translateX(-50%)",fontSize:7,color:T.forecast }}>F</span>}
            </button>
          );
        })}
      </div>
      {selectedMonth&&(
        <button onClick={onClear} style={{ marginTop:10,width:"100%",padding:"5px",borderRadius:5,
          border:`1px solid ${T.border}`,background:"transparent",color:T.t4,fontSize:10,cursor:"pointer" }}>
          ✕ 선택 해제
        </button>
      )}
      <div style={{ marginTop:8, fontSize:9, color:T.t4 }}>
        <span style={{ color:T.gold }}>●</span> 이벤트  <span style={{ color:T.forecast }}>F</span> 예측
      </div>
    </div>
  );
}

// ─── DEEP-DIVE MODAL ─────────────────────────────────────────────────────────
function DeepDiveModal({ month, scenario, onClose }) {
  if (!month) return null;
  const d = DATA_MAP[month]; if (!d) return null;
  const sc   = d.byScenario[scenario];
  const prev = ALL_MONTHS[d.idx-1];
  const pd   = prev ? DATA_MAP[prev] : null;
  const psc  = pd ? pd.byScenario[scenario] : null;
  const chg  = (a,b) => b ? ((a-b)/b*100).toFixed(1) : null;
  const cc   = (v) => +v>0?T.green:+v<0?T.red:T.t3;
  const ev   = TIMELINE_EVENTS.find(e=>e.month===month);
  const [yy] = month.split("-");
  const ytdKeys  = ALL_MONTHS.filter(m2=>m2.startsWith(yy)&&ALL_MONTHS.indexOf(m2)<=d.idx);
  const wStart   = Math.max(0, d.idx-5), wEnd=Math.min(ALL_MONTHS.length-1,d.idx+6);
  const wData    = ALL_MONTHS.slice(wStart,wEnd+1).map(m2=>{
    const dd=DATA_MAP[m2], s2=dd.byScenario[scenario];
    return {month:m2,pax:+s2.pax.toFixed(2),cargo:+s2.cargo.toFixed(2),
      opex:+s2.opex.toFixed(2),remit:+s2.remit.toFixed(2),isFc:dd.isForecast,sel:m2===month};
  });
  const kpis = [
    {l:"여객 수익",v:sc.pax,   p:psc?.pax,   c:T.cyan,  i:"🛫"},
    {l:"화물 수익",v:sc.cargo, p:psc?.cargo, c:T.gold,  i:"📦"},
    {l:"운영비",   v:sc.opex,  p:psc?.opex,  c:T.red,   i:"💸"},
    {l:"순송금",   v:sc.remit, p:psc?.remit, c:T.green, i:"💰"},
    {l:"미수금",   v:sc.ar,    p:psc?.ar,    c:T.amber, i:"📋"},
    {l:"DSO",      v:d.dso,    p:pd?.dso,    c:T.amber, i:"📅", unit:"일", raw:true},
    {l:"ABS 잔액", v:d.abs,    p:pd?.abs,    c:T.forecast,i:"🏦"},
    {l:"총 수익",  v:sc.pax+sc.cargo,p:psc?psc.pax+psc.cargo:null,c:T.t1,i:"📊"},
  ];
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",
      zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",
      backdropFilter:"blur(4px)",animation:"fadeInBg 0.2s ease" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"min(880px,96vw)",maxHeight:"92vh",
        overflowY:"auto",background:T.surface,border:`1px solid ${T.borderAccent}`,
        borderRadius:14,boxShadow:"0 24px 80px rgba(0,0,0,0.85)",animation:"slideUp 0.25s ease" }}>
        {/* Header */}
        <div style={{ padding:"18px 22px 14px",borderBottom:`1px solid ${T.border}`,
          display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:5 }}>
              <span style={{ fontSize:20,fontWeight:900,color:T.t1,fontFamily:"monospace" }}>{monthLabel(month)}</span>
              <Badge label={d.isForecast?"📊 예측":"✅ 실제"} color={d.isForecast?T.forecast:T.green}/>
              <Badge label={scenario} color={scenario==="Base"?T.cyan:scenario==="Optimistic"?T.green:T.red}/>
            </div>
            {ev&&<div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <div style={{ width:7,height:7,borderRadius:"50%",background:EV_COLOR[ev.type],
                boxShadow:`0 0 6px ${EV_COLOR[ev.type]}` }}/>
              <span style={{ fontSize:11,color:EV_COLOR[ev.type] }}>{ev.label}</span>
            </div>}
          </div>
          <button onClick={onClose} style={{ background:T.card,border:`1px solid ${T.border}`,
            borderRadius:6,width:30,height:30,color:T.t3,fontSize:15,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
        <div style={{ padding:"18px 22px" }}>
          {/* 8 KPI cards */}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16 }}>
            {kpis.map((k,i)=>{
              const delta=k.p!=null?chg(k.v,k.p):null;
              return (
                <div key={i} style={{ background:T.card,borderRadius:8,padding:"12px 14px",
                  border:`1px solid ${T.border}`,borderTop:`2px solid ${k.c}` }}>
                  <div style={{ fontSize:10,color:T.t4,marginBottom:3 }}>{k.i} {k.l}</div>
                  <div style={{ fontSize:16,fontWeight:800,color:k.c,fontFamily:"monospace" }}>
                    {k.raw?`${k.v.toFixed(1)}${k.unit}`:$m(k.v,2)}
                  </div>
                  {delta!=null&&<div style={{ fontSize:9,color:cc(delta),marginTop:2,fontWeight:600 }}>{pct(delta)} MoM</div>}
                </div>
              );
            })}
          </div>
          {/* Window chart */}
          <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px",marginBottom:12 }}>
            <div style={{ fontSize:11,color:T.t3,marginBottom:10,fontWeight:700 }}>
              📈 전후 12개월 컨텍스트
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={wData}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                <XAxis dataKey="month" tick={{fill:T.t4,fontSize:8}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
                <Tooltip content={<ChartTooltip/>}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                <ReferenceLine x={month} stroke={T.cyan} strokeWidth={2}
                  label={{value:"▼선택월",fill:T.cyan,fontSize:9}}/>
                <Bar dataKey="opex" name="운영비" fill={T.red} opacity={0.4} radius={[2,2,0,0]}/>
                <Area type="monotone" dataKey="pax"   name="여객" stroke={T.cyan} fill={T.cyanDim}  strokeWidth={2} dot={false}/>
                <Area type="monotone" dataKey="cargo" name="화물" stroke={T.gold} fill={T.goldDim}  strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="remit" name="순송금" stroke={T.green} strokeWidth={2.5}
                  dot={p=>p.payload.month===month
                    ?<circle cx={p.cx} cy={p.cy} r={5} fill={T.green} stroke={T.t1} strokeWidth={2}/>
                    :<circle cx={p.cx} cy={p.cy} r={0}/>}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* YTD + MoM */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px" }}>
              <div style={{ fontSize:11,color:T.t3,marginBottom:8,fontWeight:700 }}>📆 YTD (20{yy})</div>
              <StatRow label="여객 YTD"  value={$m(accum(ytdKeys,"pax",scenario))}   color={T.cyan}/>
              <StatRow label="화물 YTD"  value={$m(accum(ytdKeys,"cargo",scenario))} color={T.gold}/>
              <StatRow label="순송금 YTD" value={$m(accum(ytdKeys,"remit",scenario))} color={T.green}/>
              <StatRow label="포함 월수"  value={`${ytdKeys.length}개월`}/>
              <StatRow label="월평균 순송금" value={$m(accum(ytdKeys,"remit",scenario)/ytdKeys.length,2)} color={T.t2}/>
            </div>
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px" }}>
              <div style={{ fontSize:11,color:T.t3,marginBottom:8,fontWeight:700 }}>📊 전월 대비 (MoM)</div>
              {psc ? <>
                <StatRow label="여객"  value={pct(chg(sc.pax,  psc.pax))}   color={cc(chg(sc.pax,psc.pax))}/>
                <StatRow label="화물"  value={pct(chg(sc.cargo,psc.cargo))} color={cc(chg(sc.cargo,psc.cargo))}/>
                <StatRow label="운영비" value={pct(chg(sc.opex, psc.opex))}  color={cc(-chg(sc.opex,psc.opex))}/>
                <StatRow label="순송금" value={pct(chg(sc.remit,psc.remit))} color={cc(chg(sc.remit,psc.remit))}/>
                <StatRow label="미수금" value={pct(chg(sc.ar,  psc.ar))}    color={cc(-chg(sc.ar,psc.ar))}/>
              </> : <div style={{fontSize:11,color:T.t4}}>전월 없음</div>}
            </div>
          </div>
          {ev&&<div style={{ marginTop:10,padding:"11px 14px",
            background:`${EV_COLOR[ev.type]}10`,border:`1px solid ${EV_COLOR[ev.type]}40`,borderRadius:8 }}>
            <div style={{ fontSize:11,color:EV_COLOR[ev.type],fontWeight:700 }}>{ev.label}</div>
            <div style={{ fontSize:10,color:T.t4,marginTop:3 }}>
              {ev.type==="risk"&&"이 시기 항공 수요 급감. 여객 수익 전년 대비 65% 이상 감소."}
              {ev.type==="opportunity"&&"물동량 급증으로 화물 수익이 여객 수익을 초과한 첫 시기."}
              {ev.type==="milestone"&&"주요 운영 지표 전환점. 전체 수익 구조 정상화 시작."}
              {ev.type==="cash"&&"LATAM TOT(Tax on Tax) 환급금 $887K 입금 확정."}
              {ev.type==="forecast"&&"예측 기반 이벤트. 실제 발생 시 KPI 업데이트 필요."}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

// ─── INSIGHTS ────────────────────────────────────────────────────────────────
const INSIGHTS = {
  Base:[
    {icon:"📈",c:T.green, t:"2026 하반기 순송금 +5% 예상 — 중국 노선 회복 영향"},
    {icon:"⚠️",c:T.amber,t:"미수금 31-60일 구간 증가 → DSO +2.8일 위험"},
    {icon:"💧",c:T.cyan,  t:"Cash Runway 8.3개월 유지 — 유동성 양호"},
    {icon:"✅",c:T.green, t:"ABS 완전 상환 완료 — 이자비용 $3.5M 절감"},
  ],
  Optimistic:[
    {icon:"🚀",c:T.green, t:"여객 수익 +13% YoY — Charter 추가 유치 시"},
    {icon:"📦",c:T.green, t:"화물 수익 +9% — e-Commerce 물동량 증가"},
    {icon:"💎",c:T.cyan,  t:"Cash Runway 14개월 — 투자 여력 확보"},
    {icon:"🎯",c:T.gold,  t:"터미널 공사 완료 후 운영비 $2.1M/yr 절감"},
  ],
  Pessimistic:[
    {icon:"🔴",c:T.red,   t:"여객 -12% 리스크 — 환율 변동·경기 침체"},
    {icon:"⚡",c:T.red,   t:"Cash Runway 5.1개월 → 즉시 비용 절감 필요"},
    {icon:"📉",c:T.amber, t:"미수금 회수율 저하 → 선제적 컬렉션 강화"},
    {icon:"🛡️",c:T.amber, t:"Hedging 재검토 — 유류비 10% 상승 대비"},
  ],
};

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── Period range state ──────────────────────────────────────────────────
  const DEFAULT_END   = "26-03";  // last historical month
  const DEFAULT_START = "20-01";  // earliest month

  const [preset,     setPreset]     = useState("ALL");
  const [rangeStart, setRangeStart] = useState(DEFAULT_START);
  const [rangeEnd,   setRangeEnd]   = useState(DEFAULT_END);

  // ── Other state ─────────────────────────────────────────────────────────
  const [scenario,   setScenario]   = useState("Base");
  const [horizon,    setHorizon]    = useState("12M");
  const [viewMode,   setViewMode]   = useState("Combined");
  const [activeTab,  setActiveTab]  = useState("overview");
  const [selMonth,   setSelMonth]   = useState(null);
  const [drillMonth, setDrillMonth] = useState(null);

  // ── Handle preset change ────────────────────────────────────────────────
  const handlePresetChange = (pid) => {
    setPreset(pid);
    const p = PRESETS.find(p=>p.id===pid);
    if (!p) return;
    if (p.months === null) {                      // ALL
      setRangeStart(DEFAULT_START);
      setRangeEnd(DEFAULT_END);
    } else if (p.months === "custom") {           // CUSTOM — keep current
      // leave as-is, let user adjust
    } else {
      setRangeEnd(DEFAULT_END);
      setRangeStart(startFromEnd(DEFAULT_END, p.months));
    }
  };

  const handleRangeChange = (s, e) => {
    setRangeStart(s);
    setRangeEnd(e);
  };

  // ── Period month keys ───────────────────────────────────────────────────
  const periodKeys = useMemo(() => monthsInRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  // ── KPI accumulated values ──────────────────────────────────────────────
  const kpiPax   = useMemo(() => accum(periodKeys, "pax",   scenario), [periodKeys, scenario]);
  const kpiCargo = useMemo(() => accum(periodKeys, "cargo", scenario), [periodKeys, scenario]);
  const kpiRemit = useMemo(() => accum(periodKeys, "remit", scenario), [periodKeys, scenario]);
  const kpiOpex  = useMemo(() => accum(periodKeys, "opex",  scenario), [periodKeys, scenario]);
  const kpiAR    = useMemo(() => accum(periodKeys, "ar",    scenario), [periodKeys, scenario]);

  const yoyPax   = useMemo(() => periodYoY(periodKeys, "pax",   scenario), [periodKeys, scenario]);
  const yoyCargo = useMemo(() => periodYoY(periodKeys, "cargo", scenario), [periodKeys, scenario]);
  const yoyRemit = useMemo(() => periodYoY(periodKeys, "remit", scenario), [periodKeys, scenario]);

  // last DSO in range
  const lastDso  = useMemo(() => {
    const last = periodKeys[periodKeys.length - 1];
    return last ? DATA_MAP[last]?.dso ?? 0 : 0;
  }, [periodKeys]);

  // period label
  const periodLabel = useMemo(() =>
    `${monthLabel(rangeStart)} – ${monthLabel(rangeEnd)} (${periodKeys.length}개월)`,
    [rangeStart, rangeEnd, periodKeys]);

  // ── Chart data ──────────────────────────────────────────────────────────
  const horizonN = { "3M":3,"6M":6,"12M":12,"24M":20 }[horizon] ?? 12;
  const histData = useMemo(() =>
    ALL_MONTHS.slice(0, HIST_END_IDX+1).map(m=>({
      ...DATA_MAP[m], ...DATA_MAP[m].byScenario[scenario] })), [scenario]);
  const fcData = useMemo(() =>
    ALL_MONTHS.slice(HIST_END_IDX+1, HIST_END_IDX+1+horizonN).map(m=>({
      ...DATA_MAP[m], ...DATA_MAP[m].byScenario[scenario] })), [scenario, horizonN]);
  const chartData = useMemo(() =>
    viewMode==="Historical" ? histData
    : viewMode==="Forecast"  ? fcData
    : [...histData, ...fcData], [histData, fcData, viewMode]);

  // period chart data (only within selected range, for period area chart)
  const periodChartData = useMemo(() =>
    periodKeys.map(m => ({ ...DATA_MAP[m], ...DATA_MAP[m].byScenario[scenario] })),
    [periodKeys, scenario]);

  const fcRemit = fcData.reduce((s,d)=>s+d.remit, 0);

  const TABS = [
    { id:"overview", label:"📊 Overview" },
    { id:"cashflow", label:"💵 Cash Flow" },
    { id:"revenue",  label:"📈 Revenue" },
    { id:"forecast", label:"🔮 Forecast" },
  ];

  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.t1,
      fontFamily:"'DM Mono','Courier New',monospace", fontSize:13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:${T.bg};}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}
        input[type=range]{height:4px;cursor:pointer;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeInBg{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .sec{animation:fadeIn 0.3s ease both;}
        button{font-family:inherit;}
        .kbtn:hover{opacity:0.85;}
      `}</style>

      {/* ═══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`,
        padding:"16px 22px 0", position:"sticky", top:0, zIndex:100 }}>

        {/* Top row */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:8,
              background:`linear-gradient(135deg,${T.primary},${T.primaryLight})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, boxShadow:`0 4px 18px ${T.primaryGlow}` }}>✈</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:T.t1 }}>대한항공 미주지역본부</div>
              <div style={{ fontSize:9, color:T.t4 }}>통합 재무·영업 대시보드 · 2020.01 – 2027.12</div>
            </div>
            <Badge label="LIVE" color={T.green}/>
            <Badge label={scenario} color={scenario==="Base"?T.cyan:scenario==="Optimistic"?T.green:T.red}/>
            {selMonth&&<Badge label={`📅 ${monthLabel(selMonth)}`} color={T.gold}/>}
          </div>
          <div style={{ fontSize:9, color:T.t4 }}>마지막 업데이트: 2026.03.31</div>
        </div>

        {/* ── PERIOD RANGE SELECTOR (the new main feature) */}
        <div style={{ marginBottom:10 }}>
          <PeriodBar
            rangeStart={rangeStart} rangeEnd={rangeEnd} preset={preset}
            onPresetChange={handlePresetChange} onRangeChange={handleRangeChange}/>
        </div>

        {/* Controls row */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
          {/* View */}
          <div style={{ display:"flex", gap:2, background:T.card, borderRadius:6, padding:2,
            border:`1px solid ${T.border}` }}>
            {["Historical","Combined","Forecast"].map(v=>(
              <button key={v} onClick={()=>setViewMode(v)} className="kbtn" style={{
                padding:"3px 9px", borderRadius:4, border:"none", cursor:"pointer", fontSize:9, fontWeight:600,
                background:viewMode===v?T.primary:"transparent",
                color:viewMode===v?"#fff":T.t3, transition:"all 0.18s" }}>{v}</button>
            ))}
          </div>
          {/* Scenario */}
          {["Base","Optimistic","Pessimistic"].map(s=>{
            const c=s==="Base"?T.cyan:s==="Optimistic"?T.green:T.red;
            return <button key={s} onClick={()=>setScenario(s)} className="kbtn" style={{
              padding:"4px 11px", borderRadius:5, cursor:"pointer", fontSize:9, fontWeight:600,
              border:`1px solid ${scenario===s?c:T.border}`,
              background:scenario===s?`${c}20`:"transparent",
              color:scenario===s?c:T.t3, transition:"all 0.18s" }}>{s}</button>;
          })}
          {/* Horizon */}
          <div style={{ display:"flex", gap:2, background:T.card, borderRadius:6, padding:2,
            border:`1px solid ${T.border}` }}>
            {["3M","6M","12M","24M"].map(h=>(
              <button key={h} onClick={()=>setHorizon(h)} className="kbtn" style={{
                padding:"3px 8px", borderRadius:4, border:"none", cursor:"pointer", fontSize:9, fontWeight:600,
                background:horizon===h?`${T.forecast}30`:"transparent",
                color:horizon===h?T.forecast:T.t3, transition:"all 0.18s" }}>FC {h}</button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex" }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} className="kbtn" style={{
              padding:"7px 16px", border:"none", cursor:"pointer", fontSize:10, fontWeight:600,
              background:"transparent", color:activeTab===t.id?T.cyan:T.t4,
              borderBottom:activeTab===t.id?`2px solid ${T.cyan}`:"2px solid transparent",
              transition:"all 0.18s" }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ═══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ padding:"20px 22px" }}>

        {/* ─── OVERVIEW ──────────────────────────────────────────────────── */}
        {activeTab==="overview" && (
          <div className="sec">

            {/* Period context banner */}
            <div style={{ marginBottom:14, padding:"8px 16px",
              background:`${T.primary}18`, border:`1px solid ${T.primaryGlow}`,
              borderRadius:7, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:T.t4 }}>📐 현재 누적 기간</span>
              <span style={{ fontSize:12, color:T.cyan, fontWeight:700, fontFamily:"monospace" }}>
                {periodLabel}
              </span>
              <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
                <span style={{ fontSize:10, color:T.t4 }}>총 수익</span>
                <span style={{ fontSize:12, color:T.gold, fontWeight:700, fontFamily:"monospace" }}>
                  {$m(kpiPax + kpiCargo)}
                </span>
                <span style={{ fontSize:10, color:T.t4 }}>순송금</span>
                <span style={{ fontSize:12, color:T.green, fontWeight:700, fontFamily:"monospace" }}>
                  {$m(kpiRemit)}
                </span>
              </div>
            </div>

            {/* ── KPI CARDS (period-accumulated) ── */}
            <div style={{ display:"grid",
              gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))", gap:11, marginBottom:18 }}>
              <KpiCard icon="🛫" title="여객 수익 (누적)"
                val={$m(kpiPax)} sub={periodLabel} yoy={yoyPax} color={T.cyan}/>
              <KpiCard icon="📦" title="화물 수익 (누적)"
                val={$m(kpiCargo)} sub={periodLabel} yoy={yoyCargo} color={T.gold}/>
              <KpiCard icon="💰" title="순송금 (누적)"
                val={$m(kpiRemit)} sub={periodLabel} yoy={yoyRemit} color={T.green}/>
              <KpiCard icon="💸" title="운영비 (누적)"
                val={$m(kpiOpex)} sub={periodLabel} color={T.red}/>
              <KpiCard icon="📋" title="미수금 (평균)"
                val={$m(kpiAR / Math.max(periodKeys.length,1), 2)} sub="기간 내 월평균" color={T.amber}/>
              <KpiCard icon="📅" title="DSO (기간 말)"
                val={`${lastDso.toFixed(1)}일`} sub={monthLabel(rangeEnd)} color={T.amber}/>
              <KpiCard icon="🔮" title="예측 순송금"
                val={$m(fcRemit)} sub={`향후 ${horizon}`} color={T.forecast}/>
              <KpiCard icon="🏦" title="ABS 잔액"
                val="$2.4M" sub="원 $85M · 4.20%" color={T.primary}/>
            </div>

            {/* ── MAIN CHART + DATE PICKER ── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 248px", gap:12, marginBottom:14 }}>

              {/* Chart: shows FULL historical+forecast, but period shaded */}
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                <SH icon="📊" title="여객 + 화물 + 순송금 (전체 기간 / 선택 기간 강조)"
                  sub="클릭 → Deep-dive | 금색 음영 = 선택된 누적 기간"/>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartData}
                    onClick={d=>d?.activePayload?.[0]&&setDrillMonth(d.activePayload[0].payload.month)}>
                    <defs>
                      <linearGradient id="gPax" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={T.cyan} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={T.cyan} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gCargo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={T.gold} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={T.gold} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                    <XAxis dataKey="month" tick={{fill:T.t4,fontSize:8}} axisLine={false} tickLine={false}
                      interval={5} tickFormatter={m=>selMonth&&m===selMonth?`★${m}`:m}/>
                    <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false}
                      tickFormatter={v=>`$${v}M`}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    {/* Period start/end reference lines */}
                    <ReferenceLine x={rangeStart} stroke={T.gold} strokeWidth={1.5} strokeDasharray="3 2"
                      label={{value:"◀기간시작",fill:T.gold,fontSize:8}}/>
                    <ReferenceLine x={rangeEnd}   stroke={T.gold} strokeWidth={1.5} strokeDasharray="3 2"
                      label={{value:"기간종료▶",fill:T.gold,fontSize:8}}/>
                    <ReferenceLine x="26-04" stroke={T.forecast} strokeDasharray="4 2"
                      label={{value:"Forecast→",fill:T.forecast,fontSize:8}}/>
                    {selMonth&&<ReferenceLine x={selMonth} stroke={T.cyan} strokeWidth={2}
                      label={{value:"★",fill:T.cyan,fontSize:11}}/>}
                    {TIMELINE_EVENTS.map(ev=>(
                      <ReferenceLine key={ev.month} x={ev.month} stroke={`${EV_COLOR[ev.type]}45`}
                        strokeWidth={1} strokeDasharray="2 3"/>
                    ))}
                    <Area type="monotone" dataKey="pax"   name="여객" stroke={T.cyan} fill="url(#gPax)"   strokeWidth={2} dot={false}/>
                    <Area type="monotone" dataKey="cargo" name="화물" stroke={T.gold} fill="url(#gCargo)" strokeWidth={2} dot={false}/>
                    <Bar  dataKey="remit" name="순송금" fill={T.green} opacity={0.5} radius={[2,2,0,0]}/>
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{ fontSize:9, color:T.t4, marginTop:6, textAlign:"center" }}>
                  💡 차트 클릭 → 월별 Deep-dive | 금색 세로선 = 현재 선택 기간
                </div>
              </div>

              {/* Date Picker */}
              <DatePickerPanel selectedMonth={selMonth}
                onSelect={m=>{setSelMonth(m);setDrillMonth(m);}}
                onClear={()=>setSelMonth(null)}/>
            </div>

            {/* ── PERIOD BREAKDOWN CHART ── */}
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10,
              padding:"16px", marginBottom:14 }}>
              <SH icon="📐" title={`선택 기간 상세 — ${periodLabel}`}
                sub="선택된 기간만 확대 표시 | 월별 여객·화물·순송금"/>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={periodChartData}
                  onClick={d=>d?.activePayload?.[0]&&setDrillMonth(d.activePayload[0].payload.month)}>
                  <defs>
                    <linearGradient id="gPax2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={T.cyan} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={T.cyan} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gC2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={T.gold} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={T.gold} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                  <XAxis dataKey="month" tick={{fill:T.t4,fontSize:8}} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(periodChartData.length/10)-1)}/>
                  <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false}
                    tickFormatter={v=>`$${v}M`}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:10}}/>
                  <Area type="monotone" dataKey="pax"   name="여객" stroke={T.cyan} fill="url(#gPax2)" strokeWidth={2} dot={false}/>
                  <Area type="monotone" dataKey="cargo" name="화물" stroke={T.gold} fill="url(#gC2)"   strokeWidth={2} dot={false}/>
                  <Bar  dataKey="remit" name="순송금" fill={T.green} opacity={0.6} radius={[2,2,0,0]}/>
                  <Line type="monotone" dataKey="opex"  name="운영비" stroke={T.red} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 210px 1fr", gap:12 }}>
              {/* Terminal */}
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px" }}>
                <SH icon="✈️" title="터미널별 실적"/>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={[
                    {name:"LAX",revenue:42.3,cost:18.7,profit:23.6},
                    {name:"JFK",revenue:35.1,cost:16.2,profit:18.9},
                    {name:"TOGA",revenue:12.8,cost:6.1,profit:6.7},
                  ]} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                    <XAxis dataKey="name" tick={{fill:T.t3,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Bar dataKey="revenue" name="수익" fill={T.cyan}  radius={[3,3,0,0]}/>
                    <Bar dataKey="cost"    name="비용" fill={T.red}   radius={[3,3,0,0]} opacity={0.6}/>
                    <Bar dataKey="profit"  name="이익" fill={T.green} radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <CashRunwayGauge scenario={scenario}/>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px" }}>
                <SH icon="🤖" title={`AI Insights — ${scenario}`}/>
                {INSIGHTS[scenario].map((ins,i)=>(
                  <div key={i} style={{ display:"flex",gap:7,alignItems:"flex-start",
                    padding:"6px 0",borderBottom:i<3?`1px solid ${T.border}40`:"none" }}>
                    <span style={{fontSize:12}}>{ins.icon}</span>
                    <span style={{fontSize:10,color:ins.c,lineHeight:1.5}}>{ins.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── CASH FLOW ─────────────────────────────────────────────────── */}
        {activeTab==="cashflow" && (
          <div className="sec">
            <div style={{ marginBottom:12,padding:"8px 16px",background:`${T.primary}18`,
              border:`1px solid ${T.primaryGlow}`,borderRadius:7,
              display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
              <span style={{fontSize:10,color:T.t4}}>📐 선택 기간</span>
              <span style={{fontSize:12,color:T.cyan,fontWeight:700,fontFamily:"monospace"}}>{periodLabel}</span>
              <span style={{marginLeft:"auto",fontSize:10,color:T.t4}}>운영비</span>
              <span style={{fontSize:12,color:T.red,fontWeight:700,fontFamily:"monospace"}}>{$m(kpiOpex)}</span>
              <span style={{fontSize:10,color:T.t4}}>순송금</span>
              <span style={{fontSize:12,color:T.green,fontWeight:700,fontFamily:"monospace"}}>{$m(kpiRemit)}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 248px", gap:12 }}>
              <div>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px", marginBottom:12 }}>
                  <SH icon="💵" title="Cash Flow 종합" sub="클릭 → 월별 Deep-dive"/>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={chartData}
                      onClick={d=>d?.activePayload?.[0]&&setDrillMonth(d.activePayload[0].payload.month)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="month" tick={{fill:T.t4,fontSize:8}} axisLine={false} tickLine={false} interval={5}/>
                      <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <Legend wrapperStyle={{fontSize:10}}/>
                      <ReferenceLine x={rangeStart} stroke={T.gold} strokeWidth={1.5} strokeDasharray="3 2"/>
                      <ReferenceLine x={rangeEnd}   stroke={T.gold} strokeWidth={1.5} strokeDasharray="3 2"/>
                      <ReferenceLine x="26-04" stroke={T.forecast} strokeDasharray="4 2"/>
                      {selMonth&&<ReferenceLine x={selMonth} stroke={T.cyan} strokeWidth={2}/>}
                      <Bar  dataKey="opex"  name="운영비" fill={T.red}   opacity={0.5} radius={[2,2,0,0]}/>
                      <Area type="monotone" dataKey="pax"   name="여객"  stroke={T.cyan} fill={T.cyanDim}  strokeWidth={2} dot={false}/>
                      <Area type="monotone" dataKey="cargo" name="화물"  stroke={T.gold} fill={T.goldDim}  strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="remit" name="순송금" stroke={T.green} strokeWidth={2.5} dot={false}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {/* Aging */}
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px" }}>
                  <SH icon="📋" title="미수금 Aging 예측 Heatmap"/>
                  {[
                    {b:"0-30일",  cur:12.4, fc:13.1, risk:"low",      rc:T.green},
                    {b:"31-60일", cur:4.2,  fc:5.8,  risk:"medium",   rc:T.amber},
                    {b:"61-90일", cur:1.8,  fc:2.4,  risk:"high",     rc:"#f97316"},
                    {b:"90일+",   cur:0.9,  fc:1.3,  risk:"critical", rc:T.red},
                  ].map((r,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr 70px",
                      gap:8, alignItems:"center", padding:"6px 0",
                      borderBottom:`1px solid ${T.border}30` }}>
                      <span style={{fontSize:11,color:T.t3}}>{r.b}</span>
                      <div style={{ padding:"4px 8px", borderRadius:4, textAlign:"center",
                        background:`${r.rc}12`, color:r.rc, fontSize:12, fontWeight:700}}>${r.cur.toFixed(1)}M</div>
                      <div style={{ padding:"4px 8px", borderRadius:4, textAlign:"center",
                        background:`${T.forecast}12`,color:T.forecast,fontSize:12,fontWeight:700,
                        border:`1px dashed ${T.forecast}40`}}>${r.fc.toFixed(1)}M</div>
                      <Badge label={r.risk} color={r.rc}/>
                    </div>
                  ))}
                  <div style={{fontSize:9,color:T.amber,marginTop:7}}>⚠️ 31-60일 구간 $5.8M 예상 — 컬렉션 우선순위 상향 권고</div>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <DatePickerPanel selectedMonth={selMonth}
                  onSelect={m=>{setSelMonth(m);setDrillMonth(m);}} onClear={()=>setSelMonth(null)}/>
                <CashRunwayGauge scenario={scenario}/>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px" }}>
                  <SH icon="🏦" title="ABS 트래커"/>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:10,color:T.t4}}>상환 완료율</span>
                    <span style={{fontSize:12,color:T.green,fontWeight:700}}>97.2%</span>
                  </div>
                  <div style={{height:5,background:T.border,borderRadius:3,overflow:"hidden",marginBottom:8}}>
                    <div style={{height:"100%",width:"97.2%",borderRadius:3,
                      background:`linear-gradient(90deg,${T.primary},${T.green})`}}/>
                  </div>
                  {[["원금 상환","$82.6M"],["잔여 잔액","$2.4M"],["만기일","2025.03"],["절감 이자","$0.7M"]].map(([l,v],i)=>(
                    <StatRow key={i} label={l} value={v} color={T.cyan}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── REVENUE ───────────────────────────────────────────────────── */}
        {activeTab==="revenue" && (
          <div className="sec">
            <div style={{ marginBottom:12,padding:"8px 16px",background:`${T.primary}18`,
              border:`1px solid ${T.primaryGlow}`,borderRadius:7,
              display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
              <span style={{fontSize:10,color:T.t4}}>📐 선택 기간</span>
              <span style={{fontSize:12,color:T.cyan,fontWeight:700,fontFamily:"monospace"}}>{periodLabel}</span>
              <span style={{marginLeft:"auto",fontSize:10,color:T.t4}}>여객</span>
              <span style={{fontSize:12,color:T.cyan,fontWeight:700,fontFamily:"monospace"}}>{$m(kpiPax)}</span>
              <span style={{fontSize:10,color:T.t4}}>화물</span>
              <span style={{fontSize:12,color:T.gold,fontWeight:700,fontFamily:"monospace"}}>{$m(kpiCargo)}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 248px", gap:12 }}>
              <div>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px", marginBottom:12 }}>
                  <SH icon="📈" title="여객 vs 화물 수익 추이" sub="클릭 → Deep-dive"/>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={chartData}
                      onClick={d=>d?.activePayload?.[0]&&setDrillMonth(d.activePayload[0].payload.month)}>
                      <defs>
                        <linearGradient id="gPR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={T.cyan} stopOpacity={0.3}/><stop offset="95%" stopColor={T.cyan} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gCR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={T.gold} stopOpacity={0.25}/><stop offset="95%" stopColor={T.gold} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="month" tick={{fill:T.t4,fontSize:8}} axisLine={false} tickLine={false} interval={5}/>
                      <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <Legend wrapperStyle={{fontSize:10}}/>
                      <ReferenceLine x={rangeStart} stroke={T.gold} strokeWidth={1.5} strokeDasharray="3 2"
                        label={{value:"◀기간",fill:T.gold,fontSize:8}}/>
                      <ReferenceLine x={rangeEnd}   stroke={T.gold} strokeWidth={1.5} strokeDasharray="3 2"
                        label={{value:"기간▶",fill:T.gold,fontSize:8}}/>
                      <ReferenceLine x="26-04" stroke={T.forecast} strokeDasharray="4 2"/>
                      {selMonth&&<ReferenceLine x={selMonth} stroke={T.cyan} strokeWidth={2}/>}
                      <Area type="monotone" dataKey="pax"   name="여객" stroke={T.cyan} fill="url(#gPR)" strokeWidth={2} dot={false}/>
                      <Area type="monotone" dataKey="cargo" name="화물" stroke={T.gold} fill="url(#gCR)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px" }}>
                  <SH icon="🔀" title="시나리오별 여객 수익 비교 (향후 12개월)"/>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={ALL_MONTHS.slice(HIST_END_IDX+1,HIST_END_IDX+13).map(m=>({
                      month:m,
                      base: +(DATA_MAP[m]?.byScenario.Base.pax??0).toFixed(2),
                      opt:  +(DATA_MAP[m]?.byScenario.Optimistic.pax??0).toFixed(2),
                      pess: +(DATA_MAP[m]?.byScenario.Pessimistic.pax??0).toFixed(2),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="month" tick={{fill:T.t4,fontSize:8}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <Legend wrapperStyle={{fontSize:10}}/>
                      <Line type="monotone" dataKey="base" name="Base"        stroke={T.cyan}  strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="opt"  name="Optimistic"  stroke={T.green} strokeWidth={2} dot={false} strokeDasharray="5 3"/>
                      <Line type="monotone" dataKey="pess" name="Pessimistic" stroke={T.red}   strokeWidth={2} dot={false} strokeDasharray="5 3"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <DatePickerPanel selectedMonth={selMonth}
                  onSelect={m=>{setSelMonth(m);setDrillMonth(m);}} onClear={()=>setSelMonth(null)}/>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px" }}>
                  <SH icon="📅" title="Major Events Timeline"/>
                  <div style={{position:"relative",paddingLeft:12}}>
                    <div style={{position:"absolute",left:4,top:0,bottom:0,width:2,background:T.border}}/>
                    {TIMELINE_EVENTS.map((ev,i)=>(
                      <div key={i} style={{position:"relative",paddingLeft:16,paddingBottom:10,cursor:"pointer"}}
                        onClick={()=>{setSelMonth(ev.month);setDrillMonth(ev.month);}}>
                        <div style={{position:"absolute",left:-2,top:3,width:9,height:9,
                          borderRadius:"50%",background:EV_COLOR[ev.type],
                          boxShadow:`0 0 6px ${EV_COLOR[ev.type]}`}}/>
                        <div style={{fontSize:8,color:T.t4,fontFamily:"monospace"}}>{monthLabel(ev.month)}</div>
                        <div style={{fontSize:10,color:ev.type==="forecast"?T.forecast:T.t2,marginTop:1}}>{ev.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:9,color:T.t4,marginTop:4}}>💡 이벤트 클릭 → Deep-dive</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── FORECAST ──────────────────────────────────────────────────── */}
        {activeTab==="forecast" && (
          <div className="sec">
            <div style={{ display:"grid", gridTemplateColumns:"2fr 248px", gap:12 }}>
              <div>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px", marginBottom:12 }}>
                  <SH icon="🔮" title={`Forecast 상세 — ${scenario} · ${horizon}`} sub="행 클릭 → Deep-dive"/>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead>
                        <tr style={{borderBottom:`1px solid ${T.border}`}}>
                          {["월","여객","화물","운영비","순송금","미수금","DSO"].map(h=>(
                            <th key={h} style={{padding:"6px 9px",textAlign:h==="월"?"left":"right",
                              color:T.t4,fontWeight:600,fontSize:9,letterSpacing:0.5}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fcData.map((row,i)=>(
                          <tr key={i} onClick={()=>setDrillMonth(row.month)}
                            style={{background:i%2===0?`${T.forecast}05`:"transparent",
                              borderBottom:`1px solid ${T.border}20`,cursor:"pointer"}}>
                            <td style={{padding:"5px 9px",color:T.forecast,fontWeight:700}}>{row.month}</td>
                            <td style={{padding:"5px 9px",textAlign:"right",color:T.cyan}}>{$m(row.pax,2)}</td>
                            <td style={{padding:"5px 9px",textAlign:"right",color:T.gold}}>{$m(row.cargo,2)}</td>
                            <td style={{padding:"5px 9px",textAlign:"right",color:T.red}}>{$m(row.opex,2)}</td>
                            <td style={{padding:"5px 9px",textAlign:"right",color:T.green,fontWeight:700}}>{$m(row.remit,2)}</td>
                            <td style={{padding:"5px 9px",textAlign:"right",color:T.t2}}>{$m(row.ar,2)}</td>
                            <td style={{padding:"5px 9px",textAlign:"right",color:T.amber}}>{row.dso.toFixed(1)}일</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{borderTop:`1px solid ${T.border}`,fontWeight:700}}>
                          <td style={{padding:"6px 9px",color:T.t3,fontSize:10}}>합계</td>
                          <td style={{padding:"6px 9px",textAlign:"right",color:T.cyan}}>{$m(fcData.reduce((s,d)=>s+d.pax,0))}</td>
                          <td style={{padding:"6px 9px",textAlign:"right",color:T.gold}}>{$m(fcData.reduce((s,d)=>s+d.cargo,0))}</td>
                          <td style={{padding:"6px 9px",textAlign:"right",color:T.red}}>{$m(fcData.reduce((s,d)=>s+d.opex,0))}</td>
                          <td style={{padding:"6px 9px",textAlign:"right",color:T.green}}>{$m(fcRemit)}</td>
                          <td colSpan={2}/>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px" }}>
                  <SH icon="📐" title="Sensitivity Analysis — Net Cash Position"/>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart layout="vertical" data={[
                      {factor:"여객 수익 성장률",impact:4.2},
                      {factor:"미수금 회수율",   impact:2.8},
                      {factor:"운영비 증가율",   impact:-3.1},
                      {factor:"환율 USD/KRW",   impact:-1.4},
                      {factor:"화물 수익 성장률",impact:2.1},
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis type="number" tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false}
                        tickFormatter={v=>`${v>0?"+":""}${v}%`}/>
                      <YAxis type="category" dataKey="factor" tick={{fill:T.t3,fontSize:10}}
                        axisLine={false} tickLine={false} width={118}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <ReferenceLine x={0} stroke={T.t4}/>
                      <Bar dataKey="impact" name="영향도" radius={[0,3,3,0]}>
                        {[4.2,2.8,-3.1,-1.4,2.1].map((v,i)=>(
                          <Cell key={i} fill={v>0?T.green:T.red}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <DatePickerPanel selectedMonth={selMonth}
                  onSelect={m=>{setSelMonth(m);setDrillMonth(m);}} onClear={()=>setSelMonth(null)}/>
                <CashRunwayGauge scenario={scenario}/>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px"}}>
                  <SH icon="🤖" title={`AI Insights — ${scenario}`}/>
                  {INSIGHTS[scenario].map((ins,i)=>(
                    <div key={i} style={{display:"flex",gap:7,alignItems:"flex-start",
                      padding:"6px 0",borderBottom:i<3?`1px solid ${T.border}40`:"none"}}>
                      <span style={{fontSize:12}}>{ins.icon}</span>
                      <span style={{fontSize:10,color:ins.c,lineHeight:1.5}}>{ins.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{marginTop:24,paddingTop:12,borderTop:`1px solid ${T.border}`,
          display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:5}}>
          <div style={{fontSize:9,color:T.t4}}>대한항공 미주지역본부 재무팀 · 내부 기밀</div>
          <div style={{display:"flex",gap:8}}>
            {[["실제",T.cyan],["예측",T.forecast],["위험",T.red],["기회",T.green],["이벤트",T.gold]].map(([l,c])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:T.t4}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:c}}/>{l}
              </div>
            ))}
          </div>
          <div style={{fontSize:9,color:T.t4}}>KAL Analytics v3.0</div>
        </div>
      </div>

      {/* ═══ DEEP-DIVE MODAL ══════════════════════════════════════════════════ */}
      {drillMonth && (
        <DeepDiveModal month={drillMonth} scenario={scenario} onClose={()=>setDrillMonth(null)}/>
      )}
    </div>
  );
}
