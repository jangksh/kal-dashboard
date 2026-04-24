import { useState, useEffect, useRef, useMemo } from "react";
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#06080e", surface: "#0b0f1a", card: "#0f1520",
  cardHover: "#141c2e", border: "#1a2235", borderAccent: "#243044",
  primary: "#0033A0", primaryLight: "#1a4fc4", primaryGlow: "rgba(0,51,160,0.3)",
  cyan: "#00d4ff", cyanDim: "rgba(0,212,255,0.12)",
  gold: "#f5c518", goldDim: "rgba(245,197,24,0.12)",
  green: "#00e5a0", greenDim: "rgba(0,229,160,0.12)",
  red: "#ff4d6a", redDim: "rgba(255,77,106,0.12)",
  amber: "#ffb347", amberDim: "rgba(255,179,71,0.12)",
  forecast: "#b48fff", forecastDim: "rgba(180,143,255,0.12)",
  t1: "#f0f4ff", t2: "#c8d3e8", t3: "#8896b0", t4: "#4f5f78",
};

// ─── DATA GENERATION ─────────────────────────────────────────────────────────
const ALL_MONTHS = (() => {
  const out = [];
  for (let yr = 2020; yr <= 2027; yr++) {
    const maxMo = yr === 2026 ? 12 : yr === 2027 ? 12 : 12;
    for (let mo = 1; mo <= maxMo; mo++) {
      out.push(`${String(yr).slice(2)}-${String(mo).padStart(2, "0")}`);
    }
  }
  return out;
})();

const HIST_END_IDX = ALL_MONTHS.indexOf("26-03"); // last historical month

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const DATA_MAP = (() => {
  const rand = seededRand(42);
  const map = {};
  ALL_MONTHS.forEach((m, i) => {
    const yr = Math.floor(i / 12);
    const mo = i % 12;
    const isForecast = i > HIST_END_IDX;
    const covidDip = yr === 0 ? 0.35 : yr === 1 ? 0.55 : 1;
    const s = 1 + 0.22 * Math.sin((mo - 5) * Math.PI / 6);
    const g = Math.pow(1.08, yr + mo / 12);
    const noise = () => 1 + (rand() - 0.5) * (isForecast ? 0.04 : 0.08);
    const pax  = Math.max(0, 28  * covidDip * s * g * noise());
    const cargo= Math.max(0, 18  * covidDip * (1 + 0.12 * Math.sin((mo-2)*Math.PI/6)) * Math.pow(1.05,yr+mo/12) * noise());
    const opex = Math.max(0, 12  * covidDip * (1+0.08*Math.sin((mo-3)*Math.PI/6)) * Math.pow(1.04,yr+mo/12) * noise());
    const remit= (pax + cargo - opex) * 0.72;
    const ar   = pax * 0.62 * noise();
    const dso  = 28 + rand()*8 - (i>50?3:0);
    const abs  = Math.max(0, 85 - i * 1.1);
    map[m] = { month:m, idx:i, isForecast, pax, cargo, opex, remit, ar, dso, abs,
      byScenario: {
        Base:        { pax, cargo, opex, remit, ar },
        Optimistic:  { pax:pax*1.13, cargo:cargo*1.09, opex:opex*0.97, remit:(pax*1.13+cargo*1.09-opex*0.97)*0.72, ar:ar*1.05 },
        Pessimistic: { pax:pax*0.88, cargo:cargo*0.92, opex:opex*1.06, remit:(pax*0.88+cargo*0.92-opex*1.06)*0.72, ar:ar*0.93 },
      }
    };
  });
  return map;
})();

const TIMELINE_EVENTS = [
  { month:"20-02", label:"COVID-19 여객 급락", type:"risk" },
  { month:"21-06", label:"화물 수요 급증", type:"opportunity" },
  { month:"22-04", label:"국제선 전면 재개", type:"milestone" },
  { month:"23-08", label:"체리 Charter 최대 실적", type:"opportunity" },
  { month:"24-03", label:"TOT 환급 $887K 입금", type:"cash" },
  { month:"25-03", label:"ABS 만기 상환 완료", type:"milestone" },
  { month:"26-06", label:"신규 FWDR 계약 (예정)", type:"forecast" },
  { month:"26-12", label:"터미널 공사 완료 (예정)", type:"forecast" },
];

const EVENT_COLOR = { risk:T.red, opportunity:T.green, milestone:T.cyan, cash:T.gold, forecast:T.forecast };

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const $  = (v, d=1) => v==null?"—":`$${(+v).toFixed(d)}M`;
const pct= (v) => `${v>=0?"+":""}${(+v).toFixed(1)}%`;
const comma=(v,d=0)=>(+v).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g,",");

function monthLabel(m) {
  if (!m) return "";
  const [yy,mm] = m.split("-");
  const names=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `20${yy}. ${names[+mm-1]}`;
}

// ─── MICRO COMPONENTS ────────────────────────────────────────────────────────
function Badge({ label, color=T.cyan }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:1, padding:"2px 8px",
      borderRadius:3, border:`1px solid ${color}40`, color, background:`${color}15`, textTransform:"uppercase" }}>
      {label}
    </span>
  );
}

function Divider() {
  return <div style={{ height:1, background:T.border, margin:"12px 0" }} />;
}

function StatRow({ label, value, color=T.t2, sub }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"5px 0",
      borderBottom:`1px solid ${T.border}40` }}>
      <span style={{ fontSize:11, color:T.t4 }}>{label}</span>
      <div style={{ textAlign:"right" }}>
        <span style={{ fontSize:13, color, fontWeight:700, fontFamily:"monospace" }}>{value}</span>
        {sub && <span style={{ fontSize:10, color:T.t4, marginLeft:5 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:"#0a0f1cee", border:`1px solid ${T.borderAccent}`,
      borderRadius:8, padding:"12px 16px", fontSize:12, backdropFilter:"blur(10px)", minWidth:160 }}>
      <div style={{ color:T.t3, marginBottom:8, fontWeight:700, letterSpacing:0.5 }}>
        {monthLabel(label)}
      </div>
      {payload.map((p,i)=>(
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:16, marginTop:4 }}>
          <span style={{ color:T.t4 }}>{p.name}</span>
          <span style={{ color:p.color, fontWeight:700 }}>
            {typeof p.value==="number"?`$${p.value.toFixed(2)}M`:p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── CASH RUNWAY GAUGE (animated SVG) ─────────────────────────────────────────
function CashRunwayGauge({ scenario, customMonths }) {
  const runways = { Base:8.3, Optimistic:14.1, Pessimistic:5.1 };
  const base = runways[scenario];
  const val = customMonths != null ? Math.max(0, base + (customMonths / 6)) : base;
  const MAX = 18;
  const clamped = Math.min(val, MAX);
  const color = val > 9 ? T.green : val > 6 ? T.amber : T.red;
  const statusText = val < 5 ? "🔴 위기 — 즉시 비용 절감" : val < 7 ? "🟡 주의 — 모니터링 강화" : val < 10 ? "🟢 안정" : "✅ 우수";

  const R = 72, CX = 100, CY = 96;
  const startAngle = -220;
  const sweepDeg   = 260;
  const deg2rad = (d) => (d * Math.PI) / 180;
  const arcPoint = (angle) => ({
    x: CX + R * Math.cos(deg2rad(angle)),
    y: CY + R * Math.sin(deg2rad(angle)),
  });
  const bgStart = arcPoint(startAngle);
  const bgEnd   = arcPoint(startAngle + sweepDeg);
  const fillDeg = (clamped / MAX) * sweepDeg;
  const fillEnd = arcPoint(startAngle + fillDeg);
  const largeArcBg   = sweepDeg > 180 ? 1 : 0;
  const largeArcFill = fillDeg  > 180 ? 1 : 0;

  const needleDeg = startAngle + fillDeg;
  const ticks = [0,3,6,9,12,15,18];

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"18px 20px" }}>
      <div style={{ fontSize:11, color:T.t3, letterSpacing:0.8, marginBottom:4, textTransform:"uppercase", fontWeight:700 }}>
        💧 Cash Runway
      </div>
      <svg viewBox="0 0 200 120" style={{ width:"100%", overflow:"visible" }}>
        <path
          d={`M ${bgStart.x} ${bgStart.y} A ${R} ${R} 0 ${largeArcBg} 1 ${bgEnd.x} ${bgEnd.y}`}
          fill="none" stroke={T.border} strokeWidth="14" strokeLinecap="round"
        />
        {fillDeg > 1 && (
          <path
            d={`M ${bgStart.x} ${bgStart.y} A ${R} ${R} 0 ${largeArcFill} 1 ${fillEnd.x} ${fillEnd.y}`}
            fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            style={{ filter:`drop-shadow(0 0 6px ${color})`, transition:"all 0.8s ease" }}
          />
        )}
        {ticks.map(t => {
          const td = startAngle + (t / MAX) * sweepDeg;
          const inner = { x: CX + (R-10)*Math.cos(deg2rad(td)), y: CY + (R-10)*Math.sin(deg2rad(td)) };
          const outer = { x: CX + (R-2 )*Math.cos(deg2rad(td)), y: CY + (R-2 )*Math.sin(deg2rad(td)) };
          const lbl   = { x: CX + (R-22)*Math.cos(deg2rad(td)), y: CY + (R-22)*Math.sin(deg2rad(td)) };
          return (
            <g key={t}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke={T.borderAccent} strokeWidth={t%6===0?2:1} />
              {t%6===0 && (
                <text x={lbl.x} y={lbl.y+1} textAnchor="middle" dominantBaseline="middle"
                  fill={T.t4} fontSize="8">{t}</text>
              )}
            </g>
          );
        })}
        <line x1={CX} y1={CY}
          x2={CX + (R-20)*Math.cos(deg2rad(needleDeg))}
          y2={CY + (R-20)*Math.sin(deg2rad(needleDeg))}
          stroke={color} strokeWidth="2.5" strokeLinecap="round"
          style={{ transition:"all 0.8s ease", filter:`drop-shadow(0 0 4px ${color})` }}
        />
        <circle cx={CX} cy={CY} r="5" fill={color} style={{ filter:`drop-shadow(0 0 6px ${color})` }} />
        <text x={CX} y={CY+18} textAnchor="middle" fill={color} fontSize="20" fontWeight="900"
          fontFamily="'Courier New',monospace" style={{ transition:"all 0.8s ease" }}>
          {val.toFixed(1)}
        </text>
        <text x={CX} y={CY+32} textAnchor="middle" fill={T.t4} fontSize="9">개월 (months)</text>
        <text x="30" y="112" textAnchor="middle" fill={T.red} fontSize="8">위기</text>
        <text x="100" y="28"  textAnchor="middle" fill={T.amber} fontSize="8">주의</text>
        <text x="170" y="112" textAnchor="middle" fill={T.green} fontSize="8">안정</text>
      </svg>
      <div style={{ textAlign:"center", fontSize:11, color, fontWeight:600, marginTop:2 }}>{statusText}</div>
      <Divider />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, marginTop:4 }}>
        {[
          { sc:"Pessimistic", v:5.1, c:T.red },
          { sc:"Base",        v:8.3, c:T.amber },
          { sc:"Optimistic",  v:14.1,c:T.green },
        ].map(it=>(
          <div key={it.sc} style={{ textAlign:"center", padding:"5px 4px",
            background: scenario===it.sc ? `${it.c}18` : "transparent",
            border:`1px solid ${scenario===it.sc?it.c:T.border}`, borderRadius:5 }}>
            <div style={{ fontSize:9, color:T.t4 }}>{it.sc.slice(0,4)}</div>
            <div style={{ fontSize:12, color:it.c, fontWeight:700, fontFamily:"monospace" }}>{it.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DATE PICKER PANEL ───────────────────────────────────────────────────────
function DatePickerPanel({ selectedMonth, onSelect, onClear }) {
  const years = ["2020","2021","2022","2023","2024","2025","2026","2027"];
  const mos   = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const moNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const [selYear, setSelYear] = useState(selectedMonth ? "20"+selectedMonth.split("-")[0] : "2024");
  const key = (yr,mo) => `${String(yr).slice(2)}-${mo}`;

  return (
    <div style={{ background:T.card, border:`1px solid ${T.borderAccent}`, borderRadius:10, padding:"18px 20px" }}>
      <div style={{ fontSize:11, color:T.t3, letterSpacing:0.8, marginBottom:14, textTransform:"uppercase", fontWeight:700 }}>
        📅 날짜 선택 (Deep-dive)
      </div>
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:12 }}>
        {years.map(yr=>(
          <button key={yr} onClick={()=>setSelYear(yr)} style={{
            padding:"4px 10px", borderRadius:5, border:`1px solid ${selYear===yr?T.cyan:T.border}`,
            background:selYear===yr?T.cyanDim:"transparent",
            color:selYear===yr?T.cyan:T.t3, fontSize:11, fontWeight:600, cursor:"pointer",
          }}>{yr}</button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
        {mos.map((mo,i)=>{
          const k = key(selYear, mo);
          const isValid = ALL_MONTHS.includes(k);
          const isSel   = selectedMonth === k;
          const isFc    = ALL_MONTHS.indexOf(k) > HIST_END_IDX;
          const hasEvent= TIMELINE_EVENTS.some(e=>e.month===k);
          return (
            <button key={mo} disabled={!isValid} onClick={()=>isValid && onSelect(k)} style={{
              padding:"8px 4px", borderRadius:5, border:`1px solid ${isSel?T.cyan:hasEvent?`${T.gold}60`:T.border}`,
              background:isSel?T.cyanDim:hasEvent?`${T.gold}10`:"transparent",
              color:!isValid?T.t4:isSel?T.cyan:isFc?T.forecast:T.t2,
              fontSize:11, fontWeight:isSel?700:400, cursor:isValid?"pointer":"default",
              position:"relative",
            }}>
              {moNames[i]}
              {hasEvent && <span style={{ position:"absolute", top:2, right:2, width:4, height:4,
                borderRadius:"50%", background:T.gold }} />}
              {isFc && !isSel && <span style={{ position:"absolute", bottom:2, left:"50%",
                transform:"translateX(-50%)", fontSize:7, color:T.forecast }}>F</span>}
            </button>
          );
        })}
      </div>
      {selectedMonth && (
        <button onClick={onClear} style={{ marginTop:12, width:"100%", padding:"6px", borderRadius:5,
          border:`1px solid ${T.border}`, background:"transparent", color:T.t4, fontSize:11, cursor:"pointer" }}>
          ✕ 선택 해제
        </button>
      )}
      <div style={{ marginTop:10, fontSize:9, color:T.t4, lineHeight:1.6 }}>
        <span style={{ color:T.gold }}>●</span> 이벤트 있는 달 &nbsp;
        <span style={{ color:T.forecast }}>F</span> 예측 구간
      </div>
    </div>
  );
}

// ─── DEEP-DIVE MODAL ─────────────────────────────────────────────────────────
function DeepDiveModal({ month, scenario, onClose }) {
  if (!month) return null;
  const d = DATA_MAP[month];
  if (!d) return null;

  const sc = d.byScenario[scenario] || d.byScenario.Base;
  const prevM = ALL_MONTHS[d.idx - 1];
  const prevD = prevM ? DATA_MAP[prevM] : null;
  const prevSc = prevD ? (prevD.byScenario[scenario]||prevD.byScenario.Base) : null;

  const chg = (cur, prev) => prev ? ((cur-prev)/prev*100).toFixed(1) : null;
  const chgColor = (v) => +v > 0 ? T.green : +v < 0 ? T.red : T.t3;

  const event = TIMELINE_EVENTS.find(e=>e.month===month);

  const windowStart = Math.max(0, d.idx - 5);
  const windowEnd   = Math.min(ALL_MONTHS.length-1, d.idx + 6);
  const windowData  = ALL_MONTHS.slice(windowStart, windowEnd+1).map(m2 => {
    const dd = DATA_MAP[m2];
    const s2 = dd.byScenario[scenario]||dd.byScenario.Base;
    return { month:m2, pax:+s2.pax.toFixed(2), cargo:+s2.cargo.toFixed(2),
      opex:+s2.opex.toFixed(2), remit:+s2.remit.toFixed(2), isForecast:dd.isForecast, selected:m2===month };
  });

  const [yy] = month.split("-");
  const ytdMonths = ALL_MONTHS.filter(m2=>m2.startsWith(yy) && ALL_MONTHS.indexOf(m2)<=d.idx);
  const ytdPax  = ytdMonths.reduce((s,m2)=>s+(DATA_MAP[m2]?.byScenario[scenario]?.pax||0),0);
  const ytdCargo= ytdMonths.reduce((s,m2)=>s+(DATA_MAP[m2]?.byScenario[scenario]?.cargo||0),0);
  const ytdRemit= ytdMonths.reduce((s,m2)=>s+(DATA_MAP[m2]?.byScenario[scenario]?.remit||0),0);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center",
      animation:"fadeInBg 0.2s ease", backdropFilter:"blur(4px)" }}>
      <div style={{ width:"min(900px,95vw)", maxHeight:"92vh", overflowY:"auto",
        background:T.surface, border:`1px solid ${T.borderAccent}`,
        borderRadius:14, boxShadow:"0 24px 80px rgba(0,0,0,0.8)", animation:"slideUp 0.25s ease" }}>

        <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <span style={{ fontSize:22, fontWeight:900, color:T.t1, fontFamily:"'Courier New',monospace",
                letterSpacing:-1 }}>{monthLabel(month)}</span>
              <Badge label={d.isForecast ? "📊 예측 (Forecast)" : "✅ 실제 (Actual)"}
                color={d.isForecast ? T.forecast : T.green} />
              <Badge label={scenario} color={scenario==="Base"?T.cyan:scenario==="Optimistic"?T.green:T.red} />
            </div>
            {event && (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:EVENT_COLOR[event.type],
                  boxShadow:`0 0 6px ${EVENT_COLOR[event.type]}` }} />
                <span style={{ fontSize:12, color:EVENT_COLOR[event.type] }}>{event.label}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:T.card, border:`1px solid ${T.border}`,
            borderRadius:6, width:32, height:32, color:T.t3, fontSize:16, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        <div style={{ padding:"20px 24px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
            {[
              { label:"여객 수익",   val:sc.pax,   prev:prevSc?.pax,   color:T.cyan,     icon:"🛫" },
              { label:"화물 수익",   val:sc.cargo, prev:prevSc?.cargo, color:T.gold,     icon:"📦" },
              { label:"운영비",     val:sc.opex,  prev:prevSc?.opex,  color:T.red,      icon:"💸" },
              { label:"순송금",     val:sc.remit, prev:prevSc?.remit, color:T.green,    icon:"💰" },
              { label:"미수금",     val:sc.ar,    prev:prevSc?.ar,    color:T.amber,    icon:"📋" },
              { label:"DSO",        val:d.dso,    prev:prevD?.dso,    color:T.amber,    icon:"📅", unit:"일", noM:true },
              { label:"ABS 잔액",   val:d.abs,    prev:prevD?.abs,    color:T.forecast, icon:"🏦" },
              { label:"총 수익",    val:sc.pax+sc.cargo, prev:prevSc?(prevSc.pax+prevSc.cargo):null, color:T.t1, icon:"📊" },
            ].map((it,i)=>{
              const delta = it.prev != null ? chg(it.val, it.prev) : null;
              return (
                <div key={i} style={{ background:T.card, borderRadius:8, padding:"14px 16px",
                  border:`1px solid ${T.border}`, borderTop:`2px solid ${it.color}` }}>
                  <div style={{ fontSize:11, color:T.t4, marginBottom:4 }}>{it.icon} {it.label}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:it.color, fontFamily:"monospace" }}>
                    {it.noM ? `${it.val.toFixed(1)}${it.unit}` : $(it.val,2)}
                  </div>
                  {delta != null && (
                    <div style={{ fontSize:10, color:chgColor(delta), marginTop:3, fontWeight:600 }}>
                      {pct(delta)} MoM
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px", marginBottom:16 }}>
            <div style={{ fontSize:12, color:T.t3, marginBottom:12, fontWeight:700 }}>
              📈 전후 12개월 컨텍스트 — {monthLabel(month)} 기준
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={windowData}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="month" tick={{ fill:T.t4, fontSize:9 }} axisLine={false} tickLine={false}
                  tickFormatter={m2=>m2===month?`▼${m2}`:m2} />
                <YAxis tick={{ fill:T.t4, fontSize:10 }} axisLine={false} tickLine={false}
                  tickFormatter={v=>`$${v}M`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <ReferenceLine x={month} stroke={T.cyan} strokeWidth={2}
                  label={{ value:"선택월", fill:T.cyan, fontSize:10 }} />
                <Bar dataKey="opex" name="운영비" fill={T.red} opacity={0.4} radius={[2,2,0,0]} />
                <Area type="monotone" dataKey="pax" name="여객" stroke={T.cyan} fill={T.cyanDim} strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="cargo" name="화물" stroke={T.gold} fill={T.goldDim} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="remit" name="순송금" stroke={T.green} strokeWidth={2.5}
                  dot={(p)=> p.payload.month===month
                    ? <circle cx={p.cx} cy={p.cy} r={6} fill={T.green} stroke={T.t1} strokeWidth={2}/>
                    : <circle cx={p.cx} cy={p.cy} r={0} />
                  } />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
              <div style={{ fontSize:12, color:T.t3, marginBottom:10, fontWeight:700 }}>
                📆 YTD 누계 (20{yy})
              </div>
              <StatRow label="여객 수익 YTD" value={$(ytdPax)} color={T.cyan} />
              <StatRow label="화물 수익 YTD" value={$(ytdCargo)} color={T.gold} />
              <StatRow label="순송금 YTD"   value={$(ytdRemit)} color={T.green} />
              <StatRow label="포함 월수"    value={`${ytdMonths.length}개월`} color={T.t2} />
              <StatRow label="월평균 순송금" value={$(ytdRemit/ytdMonths.length,2)} color={T.t2} />
            </div>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
              <div style={{ fontSize:12, color:T.t3, marginBottom:10, fontWeight:700 }}>
                📊 전월 대비 (MoM)
              </div>
              {prevSc ? (
                <>
                  <StatRow label="여객" value={pct(chg(sc.pax,prevSc.pax))} color={chgColor(chg(sc.pax,prevSc.pax))} sub={`(${$(prevSc.pax,2)}→${$(sc.pax,2)})`} />
                  <StatRow label="화물" value={pct(chg(sc.cargo,prevSc.cargo))} color={chgColor(chg(sc.cargo,prevSc.cargo))} />
                  <StatRow label="운영비" value={pct(chg(sc.opex,prevSc.opex))} color={chgColor(-chg(sc.opex,prevSc.opex))} />
                  <StatRow label="순송금" value={pct(chg(sc.remit,prevSc.remit))} color={chgColor(chg(sc.remit,prevSc.remit))} />
                  <StatRow label="미수금" value={pct(chg(sc.ar,prevSc.ar))} color={chgColor(-chg(sc.ar,prevSc.ar))} />
                </>
              ) : <div style={{ color:T.t4, fontSize:12 }}>전월 데이터 없음</div>}
            </div>
          </div>

          {event && (
            <div style={{ marginTop:12, padding:"12px 16px",
              background:`${EVENT_COLOR[event.type]}10`,
              border:`1px solid ${EVENT_COLOR[event.type]}40`,
              borderRadius:8 }}>
              <div style={{ fontSize:12, color:EVENT_COLOR[event.type], fontWeight:700 }}>
                {event.label}
              </div>
              <div style={{ fontSize:11, color:T.t4, marginTop:4 }}>
                {event.type==="risk" && "이 시기 항공 수요 급감. 여객 수익 전년 대비 65% 이상 감소."}
                {event.type==="opportunity" && "물동량 급증으로 화물 수익이 여객 수익을 초과한 첫 시기."}
                {event.type==="milestone" && "주요 운영 지표 전환점. 전체 수익 구조 정상화 시작."}
                {event.type==="cash" && "LATAM TOT(Tax on Tax) 환급금 $887K 입금 확정."}
                {event.type==="forecast" && "예측 기반 이벤트. 실제 발생 시 KPI 업데이트 필요."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────
function KpiCard({ title, val, sub, delta, color=T.cyan, alert=false, icon }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${alert?T.red:T.border}`,
      borderTop:`2px solid ${alert?T.red:color}`, borderRadius:8, padding:"16px 18px",
      position:"relative", overflow:"hidden",
      boxShadow:alert?`0 0 18px ${T.redDim}`:"none" }}>
      {alert && <div style={{ position:"absolute", top:10, right:10, width:7, height:7,
        borderRadius:"50%", background:T.red, animation:"pulse 1.4s infinite" }} />}
      <div style={{ fontSize:10, color:T.t4, letterSpacing:0.8, marginBottom:5, textTransform:"uppercase" }}>
        {icon} {title}
      </div>
      <div style={{ fontSize:21, fontWeight:800, color:T.t1, fontFamily:"monospace" }}>{val}</div>
      <div style={{ fontSize:10, color:T.t4, marginTop:2 }}>{sub}</div>
      {delta!=null && (
        <div style={{ fontSize:11, color:+delta>0?T.green:+delta<0?T.red:T.t3, marginTop:5, fontWeight:600 }}>
          {pct(delta)} <span style={{ color:T.t4, fontWeight:400 }}>YoY</span>
        </div>
      )}
    </div>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SH({ icon, title, sub }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ fontSize:14, fontWeight:800, color:T.t1, letterSpacing:0.2 }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize:11, color:T.t4, marginTop:2, marginLeft:24 }}>{sub}</div>}
    </div>
  );
}

// ─── INSIGHTS ────────────────────────────────────────────────────────────────
const INSIGHTS = {
  Base:[
    { icon:"📈", c:T.green,  t:"2026 하반기 순송금 +5% 예상 — 중국 노선 회복 영향" },
    { icon:"⚠️", c:T.amber, t:"미수금 31-60일 구간 증가 예상 → DSO +2.8일 위험" },
    { icon:"💧", c:T.cyan,  t:"Cash Runway 8.3개월 유지 — 현재 유동성 양호" },
    { icon:"✅", c:T.green,  t:"ABS 완전 상환 완료 — 연간 이자비용 $3.5M 절감" },
  ],
  Optimistic:[
    { icon:"🚀", c:T.green,  t:"여객 수익 +13% YoY — Charter 추가 유치 시 달성 가능" },
    { icon:"📦", c:T.green,  t:"화물 수익 +9% — 미주 e-Commerce 물동량 증가" },
    { icon:"💎", c:T.cyan,  t:"Cash Runway 14개월 — 추가 투자 여력 확보 가능" },
    { icon:"🎯", c:T.gold,  t:"터미널 공사 완료 후 운영비 $2.1M/yr 절감 예상" },
  ],
  Pessimistic:[
    { icon:"🔴", c:T.red,   t:"여객 -12% 리스크 — 환율 변동·경기 침체 시나리오" },
    { icon:"⚡", c:T.red,   t:"Cash Runway 5.1개월 → 즉시 비용 절감 검토 필요" },
    { icon:"📉", c:T.amber, t:"미수금 회수율 저하 → 선제적 컬렉션 강화 권고" },
    { icon:"🛡️", c:T.amber, t:"Hedging 재검토 — 유류비 10% 상승 시나리오 반영" },
  ],
};

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [scenario,  setScenario]  = useState("Base");
  const [horizon,   setHorizon]   = useState("12M");
  const [viewMode,  setViewMode]  = useState("Combined");
  const [activeTab, setActiveTab] = useState("overview");
  const [selMonth,  setSelMonth]  = useState(null);
  const [drillMonth,setDrillMonth]= useState(null);

  const horizonN = { "3M":3,"6M":6,"12M":12,"24M":20 }[horizon] ?? 12;
  const histData = useMemo(()=>
    ALL_MONTHS.slice(0, HIST_END_IDX+1).map(m=>({
      ...DATA_MAP[m], ...DATA_MAP[m].byScenario[scenario] })),[scenario]);
  const fcData = useMemo(()=>
    ALL_MONTHS.slice(HIST_END_IDX+1, HIST_END_IDX+1+horizonN).map(m=>({
      ...DATA_MAP[m], ...DATA_MAP[m].byScenario[scenario] })),[scenario,horizonN]);
  const chartData = useMemo(()=>
    viewMode==="Historical" ? histData
    : viewMode==="Forecast"  ? fcData
    : [...histData, ...fcData],[histData,fcData,viewMode]);

  const totPax   = histData.reduce((s,d)=>s+d.pax,0);
  const totCargo = histData.reduce((s,d)=>s+d.cargo,0);
  const totRemit = histData.reduce((s,d)=>s+d.remit,0);
  const fcRemit  = fcData.reduce((s,d)=>s+d.remit,0);
  const lastDso  = histData[histData.length-1]?.dso ?? 0;

  const openDrill = (m) => { setDrillMonth(m); };

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
        .sec{animation:fadeIn 0.35s ease both;}
        button{font-family:inherit;}
      `}</style>

      {/* ═══ HEADER ═════════════════════════════════════════════ */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`,
        padding:"18px 24px 0", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:38, height:38, borderRadius:8,
              background:`linear-gradient(135deg,${T.primary},${T.primaryLight})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, boxShadow:`0 4px 20px ${T.primaryGlow}` }}>✈</div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:T.t1 }}>대한항공 미주지역본부</div>
              <div style={{ fontSize:10, color:T.t4 }}>통합 재무·영업 대시보드 · 2020.01 – 2027.12</div>
            </div>
            <Badge label="LIVE" color={T.green} />
            <Badge label={scenario} color={scenario==="Base"?T.cyan:scenario==="Optimistic"?T.green:T.red} />
            {selMonth && <Badge label={`📅 ${monthLabel(selMonth)}`} color={T.gold} />}
          </div>
          <div style={{ fontSize:10, color:T.t4 }}>마지막 업데이트: 2026.03.31</div>
        </div>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12, alignItems:"center" }}>
          <div style={{ display:"flex", gap:3, background:T.card, borderRadius:6, padding:3, border:`1px solid ${T.border}` }}>
            {["Historical","Combined","Forecast"].map(v=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{
                padding:"4px 10px", borderRadius:4, border:"none", cursor:"pointer", fontSize:10, fontWeight:600,
                background:viewMode===v?T.primary:"transparent", color:viewMode===v?"#fff":T.t3, transition:"all 0.2s" }}>
                {v}
              </button>
            ))}
          </div>
          {["Base","Optimistic","Pessimistic"].map(s=>{
            const c=s==="Base"?T.cyan:s==="Optimistic"?T.green:T.red;
            return (
              <button key={s} onClick={()=>setScenario(s)} style={{
                padding:"5px 12px", borderRadius:5, cursor:"pointer", fontSize:10, fontWeight:600,
                border:`1px solid ${scenario===s?c:T.border}`,
                background:scenario===s?`${c}20`:"transparent", color:scenario===s?c:T.t3, transition:"all 0.2s" }}>
                {s}
              </button>
            );
          })}
          <div style={{ display:"flex", gap:3, background:T.card, borderRadius:6, padding:3, border:`1px solid ${T.border}` }}>
            {["3M","6M","12M","24M"].map(h=>(
              <button key={h} onClick={()=>setHorizon(h)} style={{
                padding:"4px 9px", borderRadius:4, border:"none", cursor:"pointer", fontSize:10, fontWeight:600,
                background:horizon===h?`${T.forecast}30`:"transparent",
                color:horizon===h?T.forecast:T.t3, transition:"all 0.2s" }}>
                {h}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", gap:0 }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              padding:"8px 18px", border:"none", cursor:"pointer", fontSize:11, fontWeight:600,
              background:"transparent", color:activeTab===t.id?T.cyan:T.t4,
              borderBottom:activeTab===t.id?`2px solid ${T.cyan}`:"2px solid transparent",
              transition:"all 0.2s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ BODY ═══════════════════════════════════════════════ */}
      <div style={{ padding:"22px 24px" }}>

        {/* ─── OVERVIEW ─────────────────────────────────────── */}
        {activeTab==="overview" && (
          <div className="sec">
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:12, marginBottom:20 }}>
              <KpiCard icon="🛫" title="여객 수익 누적" val={$(totPax)}   sub="2020.01–2026.03" delta={12.4} color={T.cyan} />
              <KpiCard icon="📦" title="화물 수익 누적" val={$(totCargo)} sub="2020.01–2026.03" delta={7.2}  color={T.gold} />
              <KpiCard icon="💰" title="순송금 누적"   val={$(totRemit)} sub="본사 송금 합계"   delta={9.1}  color={T.green} />
              <KpiCard icon="🔮" title="예측 순송금"   val={$(fcRemit)}  sub={`향후 ${horizon}`} color={T.forecast} />
              <KpiCard icon="📋" title="DSO 최근"     val={`${lastDso.toFixed(1)}일`} sub="매출채권 회수" delta={-2.1} color={T.amber} />
              <KpiCard icon="🏦" title="ABS 잔액"     val="$2.4M"       sub="원 $85M·4.20%"  delta={-97.2} color={T.primary} />
              <KpiCard icon="💧" title="Cash Runway"
                val={`${scenario==="Base"?8.3:scenario==="Optimistic"?14.1:5.1}개월`}
                sub={scenario} alert={scenario==="Pessimistic"} color={scenario==="Pessimistic"?T.red:T.green} />
              <KpiCard icon="✈️" title="터미널 이익"  val="$49.2M"      sub="LAX+JFK+TOGA"   delta={6.3}  color={T.cyan} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:14, marginBottom:16 }}>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"18px" }}>
                <SH icon="📊" title="여객 + 화물 + 순송금 (Historical → Forecast)"
                  sub="차트 클릭 또는 좌측 날짜 선택 → Deep-dive 상세 분석" />
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData}
                    onClick={d=> d?.activePayload?.[0] && openDrill(d.activePayload[0].payload.month)}>
                    <defs>
                      <linearGradient id="gPax"  x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={T.cyan} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={T.cyan} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gCargo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={T.gold} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={T.gold} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="month" tick={{ fill:T.t4, fontSize:8 }} axisLine={false} tickLine={false}
                      interval={5}
                      tickFormatter={m=> selMonth&&m===selMonth ? `★${m}` : m} />
                    <YAxis tick={{ fill:T.t4, fontSize:9 }} axisLine={false} tickLine={false}
                      tickFormatter={v=>`$${v}M`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize:10, color:T.t3 }} />
                    <ReferenceLine x="26-04" stroke={T.forecast} strokeDasharray="4 2"
                      label={{ value:"Forecast→", fill:T.forecast, fontSize:9 }} />
                    {selMonth && (
                      <ReferenceLine x={selMonth} stroke={T.gold} strokeWidth={2}
                        label={{ value:"★ 선택월", fill:T.gold, fontSize:9 }} />
                    )}
                    {TIMELINE_EVENTS.map(ev=>(
                      <ReferenceLine key={ev.month} x={ev.month} stroke={`${EVENT_COLOR[ev.type]}50`}
                        strokeWidth={1} strokeDasharray="2 3" />
                    ))}
                    <Area type="monotone" dataKey="pax"   name="여객" stroke={T.cyan} fill="url(#gPax)"   strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="cargo" name="화물" stroke={T.gold} fill="url(#gCargo)" strokeWidth={2} dot={false} />
                    <Bar dataKey="remit" name="순송금" fill={T.green} opacity={0.55} radius={[2,2,0,0]} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{ fontSize:10, color:T.t4, marginTop:8, textAlign:"center" }}>
                  💡 차트의 아무 지점이나 클릭하면 해당 월 Deep-dive가 열립니다
                </div>
              </div>

              <DatePickerPanel
                selectedMonth={selMonth}
                onSelect={(m)=>{ setSelMonth(m); openDrill(m); }}
                onClear={()=>setSelMonth(null)} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 220px 1fr", gap:14 }}>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                <SH icon="✈️" title="터미널별 실적 (LAX / JFK / TOGA)" />
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={[
                    { name:"LAX", revenue:42.3, cost:18.7, profit:23.6 },
                    { name:"JFK", revenue:35.1, cost:16.2, profit:18.9 },
                    { name:"TOGA",revenue:12.8, cost:6.1,  profit:6.7  },
                  ]} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="name" tick={{ fill:T.t3, fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:T.t4, fontSize:9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="revenue" name="수익" fill={T.cyan} radius={[3,3,0,0]} />
                    <Bar dataKey="cost"    name="비용" fill={T.red}  radius={[3,3,0,0]} opacity={0.6} />
                    <Bar dataKey="profit"  name="이익" fill={T.green}radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <CashRunwayGauge scenario={scenario} />

              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                <SH icon="🤖" title={`AI Insights — ${scenario}`} />
                {INSIGHTS[scenario].map((ins,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start",
                    padding:"7px 0", borderBottom:i<3?`1px solid ${T.border}40`:"none" }}>
                    <span style={{ fontSize:13 }}>{ins.icon}</span>
                    <span style={{ fontSize:11, color:ins.c, lineHeight:1.5 }}>{ins.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── CASH FLOW ────────────────────────────────────── */}
        {activeTab==="cashflow" && (
          <div className="sec">
            <div style={{ display:"grid", gridTemplateColumns:"2fr 260px", gap:14 }}>
              <div>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px", marginBottom:14 }}>
                  <SH icon="💵" title="Cash Flow 종합 (수입·지출·순송금)" sub="클릭 → 월별 Deep-dive" />
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData}
                      onClick={d=>d?.activePayload?.[0]&&openDrill(d.activePayload[0].payload.month)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="month" tick={{fill:T.t4,fontSize:8}} axisLine={false} tickLine={false} interval={5}/>
                      <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <Legend wrapperStyle={{fontSize:10}}/>
                      <ReferenceLine x="26-04" stroke={T.forecast} strokeDasharray="4 2"/>
                      {selMonth&&<ReferenceLine x={selMonth} stroke={T.gold} strokeWidth={2}/>}
                      <Bar dataKey="opex" name="운영비" fill={T.red} opacity={0.5} radius={[2,2,0,0]}/>
                      <Area type="monotone" dataKey="pax" name="여객" stroke={T.cyan} fill={T.cyanDim} strokeWidth={2} dot={false}/>
                      <Area type="monotone" dataKey="cargo" name="화물" stroke={T.gold} fill={T.goldDim} strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="remit" name="순송금" stroke={T.green} strokeWidth={2.5} dot={false}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                  <SH icon="📋" title="미수금 Aging 예측 Heatmap" />
                  {[
                    { b:"0-30일",  cur:12.4, fc:13.1, risk:"low",      rc:T.green },
                    { b:"31-60일", cur:4.2,  fc:5.8,  risk:"medium",   rc:T.amber },
                    { b:"61-90일", cur:1.8,  fc:2.4,  risk:"high",     rc:"#f97316" },
                    { b:"90일+",   cur:0.9,  fc:1.3,  risk:"critical", rc:T.red },
                  ].map((r,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr 70px",
                      gap:8, alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${T.border}30` }}>
                      <span style={{ fontSize:11, color:T.t3 }}>{r.b}</span>
                      <div style={{ padding:"5px 10px", borderRadius:4, textAlign:"center",
                        background:`${r.rc}12`, color:r.rc, fontSize:12, fontWeight:700 }}>${r.cur.toFixed(1)}M</div>
                      <div style={{ padding:"5px 10px", borderRadius:4, textAlign:"center",
                        background:`${T.forecast}12`, color:T.forecast, fontSize:12, fontWeight:700,
                        border:`1px dashed ${T.forecast}40` }}>${r.fc.toFixed(1)}M</div>
                      <Badge label={r.risk} color={r.rc} />
                    </div>
                  ))}
                  <div style={{ fontSize:10, color:T.amber, marginTop:8 }}>
                    ⚠️ 31-60일 구간 $5.8M 예상 — 컬렉션 우선순위 상향 권고
                  </div>
                </div>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <DatePickerPanel selectedMonth={selMonth}
                  onSelect={(m)=>{setSelMonth(m);openDrill(m);}} onClear={()=>setSelMonth(null)}/>
                <CashRunwayGauge scenario={scenario}/>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                  <SH icon="🏦" title="ABS 트래커 (4.20%)" />
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:10, color:T.t4 }}>상환 완료율</span>
                    <span style={{ fontSize:13, color:T.green, fontWeight:700 }}>97.2%</span>
                  </div>
                  <div style={{ height:6, background:T.border, borderRadius:3, overflow:"hidden", marginBottom:10 }}>
                    <div style={{ height:"100%", width:"97.2%", borderRadius:3,
                      background:`linear-gradient(90deg,${T.primary},${T.green})` }}/>
                  </div>
                  {[["원금 상환","$82.6M"],["잔여 잔액","$2.4M"],["만기일","2025.03"],["절감 이자","$0.7M"]].map(([l,v],i)=>(
                    <StatRow key={i} label={l} value={v} color={T.cyan}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── REVENUE ──────────────────────────────────────── */}
        {activeTab==="revenue" && (
          <div className="sec">
            <div style={{ display:"grid", gridTemplateColumns:"2fr 260px", gap:14 }}>
              <div>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px", marginBottom:14 }}>
                  <SH icon="📈" title="여객 vs 화물 수익 추이 + 시나리오 예측" sub="클릭 → 월별 Deep-dive" />
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData}
                      onClick={d=>d?.activePayload?.[0]&&openDrill(d.activePayload[0].payload.month)}>
                      <defs>
                        <linearGradient id="gP2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={T.cyan} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={T.cyan} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gC2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={T.gold} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={T.gold} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="month" tick={{fill:T.t4,fontSize:8}} axisLine={false} tickLine={false} interval={5}/>
                      <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <Legend wrapperStyle={{fontSize:10}}/>
                      <ReferenceLine x="26-04" stroke={T.forecast} strokeDasharray="4 2"
                        label={{value:"예측 시작",fill:T.forecast,fontSize:9}}/>
                      {selMonth&&<ReferenceLine x={selMonth} stroke={T.gold} strokeWidth={2}
                        label={{value:"★",fill:T.gold,fontSize:12}}/>}
                      {TIMELINE_EVENTS.map(ev=>(
                        <ReferenceLine key={ev.month} x={ev.month} stroke={`${EVENT_COLOR[ev.type]}50`} strokeWidth={1} strokeDasharray="2 3"/>
                      ))}
                      <Area type="monotone" dataKey="pax"   name="여객" stroke={T.cyan} fill="url(#gP2)" strokeWidth={2} dot={false}/>
                      <Area type="monotone" dataKey="cargo" name="화물" stroke={T.gold} fill="url(#gC2)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                  <SH icon="🔀" title="시나리오별 여객 수익 비교 (향후 12개월)" />
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={ALL_MONTHS.slice(HIST_END_IDX+1,HIST_END_IDX+13).map(m=>({
                      month:m,
                      base:+(DATA_MAP[m]?.byScenario.Base.pax??0).toFixed(2),
                      opt: +(DATA_MAP[m]?.byScenario.Optimistic.pax??0).toFixed(2),
                      pess:+(DATA_MAP[m]?.byScenario.Pessimistic.pax??0).toFixed(2),
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

              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <DatePickerPanel selectedMonth={selMonth}
                  onSelect={(m)=>{setSelMonth(m);openDrill(m);}} onClear={()=>setSelMonth(null)}/>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                  <SH icon="📅" title="Major Events Timeline" />
                  <div style={{ position:"relative", paddingLeft:14 }}>
                    <div style={{ position:"absolute", left:5, top:0, bottom:0, width:2, background:T.border }}/>
                    {TIMELINE_EVENTS.map((ev,i)=>(
                      <div key={i} style={{ position:"relative", paddingLeft:18, paddingBottom:12, cursor:"pointer" }}
                        onClick={()=>{setSelMonth(ev.month);openDrill(ev.month);}}>
                        <div style={{ position:"absolute", left:-1, top:3, width:9, height:9,
                          borderRadius:"50%", background:EVENT_COLOR[ev.type],
                          boxShadow:`0 0 7px ${EVENT_COLOR[ev.type]}`,
                          border:ev.type==="forecast"?`2px dashed ${T.forecast}`:"none" }}/>
                        <div style={{ fontSize:9, color:T.t4, fontFamily:"monospace" }}>{monthLabel(ev.month)}</div>
                        <div style={{ fontSize:11, color:ev.type==="forecast"?T.forecast:T.t2, marginTop:1 }}>{ev.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:10, color:T.t4, marginTop:4 }}>💡 이벤트 클릭 → Deep-dive</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── FORECAST ─────────────────────────────────────── */}
        {activeTab==="forecast" && (
          <div className="sec">
            <div style={{ display:"grid", gridTemplateColumns:"2fr 260px", gap:14 }}>
              <div>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px", marginBottom:14 }}>
                  <SH icon="🔮" title={`Forecast 상세 테이블 — ${scenario} · ${horizon}`}
                    sub="행 클릭 → Deep-dive 상세 분석" />
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead>
                        <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                          {["월","여객","화물","운영비","순송금","미수금","DSO"].map(h=>(
                            <th key={h} style={{ padding:"7px 10px", color:T.t4, fontWeight:600, fontSize:10, letterSpacing:0.5,
                              textAlign:h==="월"?"left":"right" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fcData.map((row,i)=>(
                          <tr key={i}
                            onClick={()=>openDrill(row.month)}
                            style={{ background:selMonth===row.month?`${T.gold}12`:i%2===0?`${T.forecast}05`:"transparent",
                              borderBottom:`1px solid ${T.border}20`, cursor:"pointer", transition:"background 0.15s",
                              outline:selMonth===row.month?`1px solid ${T.gold}`:"none" }}>
                            <td style={{ padding:"6px 10px", color:selMonth===row.month?T.gold:T.forecast, fontWeight:700 }}>
                              {selMonth===row.month?"★ ":""}{row.month}
                            </td>
                            <td style={{ padding:"6px 10px", textAlign:"right", color:T.cyan }}>{$(row.pax,2)}</td>
                            <td style={{ padding:"6px 10px", textAlign:"right", color:T.gold }}>{$(row.cargo,2)}</td>
                            <td style={{ padding:"6px 10px", textAlign:"right", color:T.red }}>{$(row.opex,2)}</td>
                            <td style={{ padding:"6px 10px", textAlign:"right", color:T.green, fontWeight:700 }}>{$(row.remit,2)}</td>
                            <td style={{ padding:"6px 10px", textAlign:"right", color:T.t2 }}>{$(row.ar,2)}</td>
                            <td style={{ padding:"6px 10px", textAlign:"right", color:T.amber }}>{row.dso.toFixed(1)}일</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop:`1px solid ${T.border}`, fontWeight:700 }}>
                          <td style={{ padding:"7px 10px", color:T.t3, fontSize:10 }}>합계</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", color:T.cyan }}>{$(fcData.reduce((s,d)=>s+d.pax,0))}</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", color:T.gold }}>{$(fcData.reduce((s,d)=>s+d.cargo,0))}</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", color:T.red }}>{$(fcData.reduce((s,d)=>s+d.opex,0))}</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", color:T.green }}>{$(fcRemit)}</td>
                          <td colSpan={2}/>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                  <SH icon="📐" title="Sensitivity Analysis — Net Cash Position 영향" sub="변수 1% 변화 시 순현금 포지션 변동" />
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart layout="vertical" data={[
                      { factor:"여객 수익 성장률",  impact:4.2 },
                      { factor:"미수금 회수율",    impact:2.8 },
                      { factor:"운영비 증가율",    impact:-3.1 },
                      { factor:"환율 USD/KRW",    impact:-1.4 },
                      { factor:"화물 수익 성장률", impact:2.1 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis type="number" tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false}
                        tickFormatter={v=>`${v>0?"+":""}${v}%`}/>
                      <YAxis type="category" dataKey="factor" tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false} width={120}/>
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

              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <DatePickerPanel selectedMonth={selMonth}
                  onSelect={(m)=>{setSelMonth(m);openDrill(m);}} onClear={()=>setSelMonth(null)}/>
                <CashRunwayGauge scenario={scenario}/>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px" }}>
                  <SH icon="🤖" title={`AI Insights — ${scenario}`}/>
                  {INSIGHTS[scenario].map((ins,i)=>(
                    <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start",
                      padding:"7px 0", borderBottom:i<3?`1px solid ${T.border}40`:"none" }}>
                      <span style={{ fontSize:13 }}>{ins.icon}</span>
                      <span style={{ fontSize:11, color:ins.c, lineHeight:1.5 }}>{ins.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop:28, paddingTop:14, borderTop:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
          <div style={{ fontSize:9, color:T.t4 }}>대한항공 미주지역본부 재무팀 · 내부 기밀 자료</div>
          <div style={{ display:"flex", gap:10 }}>
            {[["실제",T.cyan],["예측",T.forecast],["위험",T.red],["기회",T.green],["이벤트",T.gold]].map(([l,c])=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:T.t4 }}>
                <div style={{ width:7,height:7,borderRadius:"50%",background:c }}/>{l}
              </div>
            ))}
          </div>
          <div style={{ fontSize:9, color:T.t4 }}>KAL Analytics Platform v3.0</div>
        </div>
      </div>

      {/* ═══ DEEP-DIVE MODAL ════════════════════════════════════ */}
      {drillMonth && (
        <DeepDiveModal month={drillMonth} scenario={scenario} onClose={()=>setDrillMonth(null)} />
      )}
    </div>
  );
}
