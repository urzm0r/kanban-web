import { useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Card, ListType } from "../types";
import { useTranslation } from "react-i18next";

interface Props {
  boardCards: Card[];
  lists: ListType[];
}

export default function TelemetryColumn({ boardCards, lists }: Props) {
  const [chartType, setChartType] = useState<number>(1);
  const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

  const { t } = useTranslation();

  // --- Compute various datas ---

  // 1. Workload Distribution
  const workloadData = lists.filter(l => l.type !== "TELEMETRY").map(list => {
      const count = boardCards.filter(c => c.listId === list.id && !c.isDone).length;
      return { name: list.title, value: count };
  }).filter(d => d.value > 0);
  if (workloadData.length === 0) workloadData.push({ name: "Empty", value: 1 });

  // 2. Card Aging
  const now = new Date().getTime();
  let newCards = 0, activeCards = 0, staleCards = 0;
  boardCards.forEach(c => {
      if (c.isDone) return;
      const diffDays = (now - new Date(c.createdAt).getTime()) / (1000 * 3600 * 24);
      if (diffDays < 1) newCards++;
      else if (diffDays <= 7) activeCards++;
      else staleCards++;
  });
  const agingData = [
      { name: "New (<24h)", value: newCards },
      { name: "Active (1-7d)", value: activeCards },
      { name: "Stale (>7d)", value: staleCards }
  ].filter(d => d.value > 0);
  if (agingData.length === 0) agingData.push({ name: "Empty", value: 1 });

  // 3. Actionable vs Locked
  let locked = 0, actionable = 0;
  boardCards.forEach(c => {
      if (!c.isDone) {
          if (c.lockedBy) locked++;
          else actionable++;
      }
  });
  const lockData = [
      { name: "Locked (Editing)", value: locked },
      { name: "Actionable", value: actionable }
  ].filter(d => d.value > 0);
  if (lockData.length === 0) lockData.push({ name: "Empty", value: 1 });

  // 4. Priority Split
  let pHigh = 0, pMed = 0, pLow = 0;
  boardCards.forEach(c => {
      if (!c.isDone) {
          if (c.priority === 'High') pHigh++;
          else if (c.priority === 'Low') pLow++;
          else pMed++;
      }
  });
  const priorityData = [
      { name: "High", value: pHigh },
      { name: "Medium", value: pMed },
      { name: "Low", value: pLow }
  ].filter(d => d.value > 0);
  if (priorityData.length === 0) priorityData.push({ name: "Empty", value: 1 });

  // 5. Tags Frequency
  const tagCounts: Record<string, number> = {};
  boardCards.forEach(c => {
    if (c.tags && c.tags.length > 0) {
      c.tags.forEach(t => tagCounts[t.name] = (tagCounts[t.name] || 0) + 1);
    }
  });
  const tagPieData = Object.keys(tagCounts).map(t => ({ name: t, value: tagCounts[t] }));
  if (tagPieData.length === 0) tagPieData.push({ name: t("noTags"), value: 1 });

  const getActiveChartData = () => {
      switch(chartType) {
          case 1: return workloadData;
          case 2: return agingData;
          case 3: return lockData;
          case 4: return priorityData;
          case 5: return tagPieData;
          default: return tagPieData;
      }
  };

  const getActiveChartTitle = () => {
      switch(chartType) {
          case 1: return t("workload_distribution");
          case 2: return t("card_aging");
          case 3: return t("locked_actionable");
          case 4: return t("priority_split");
          case 5: return t("effort_distribution");
          default: return "";
      }
  };

  // 6. Card Velocity (Static Bottom Chart)
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const velocityMap = new Array(7).fill(0);
  boardCards.forEach(c => {
    if (c.isDone) {
      const dateToUse = c.completedAt ? new Date(c.completedAt) : new Date(c.createdAt);
      const day = dateToUse.getDay();
      velocityMap[day]++;
    }
  });
  const velocityData = [1,2,3,4,5,6,0].map(dayIdx => ({
     name: days[dayIdx],
     value: velocityMap[dayIdx]
  }));

  // 7. Status Breakdown
  const total = boardCards.length || 1;
  const doneCards = boardCards.filter(c => c.isDone).length;
  let inProgressCards = 0;
  let toDoCards = 0;
  boardCards.filter(c => !c.isDone).forEach(c => {
     if (c.inProgress) {
         inProgressCards++;
     } else {
         toDoCards++;
     }
  });
  const donePct = Math.round((doneCards / total) * 100);
  const progPct = Math.round((inProgressCards / total) * 100);
  const todoPct = Math.round((toDoCards / total) * 100);

  return (
    <div className="flex flex-col flex-grow p-4 gap-6 overflow-y-auto w-full text-slate-200 pointer-events-none border-t border-[#26282e] custom-scrollbar bg-[#1a1c20]">
      
      {/* Dynamic Pie Chart Section */}
      <div className="flex flex-col gap-3 pointer-events-auto">
        <select 
            value={chartType} 
            onChange={(e) => setChartType(Number(e.target.value))}
            className="w-full bg-[#111113] border border-slate-700 rounded-md py-1.5 px-2 text-sm font-bold text-slate-300 focus:outline-none focus:border-[#3b82f6] shadow-md cursor-pointer"
        >
            <option value={1}>📊 {t("workload_distribution")}</option>
            <option value={2}>⏳ {t("card_aging")}</option>
            <option value={3}>🔒 {t("locked_actionable")}</option>
            <option value={4}>⚡ {t("priority_split")}</option>
            <option value={5}>🏷️ {t("effort_distribution")}</option>
        </select>
        
        <div className="h-[180px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={getActiveChartData()}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {getActiveChartData().map((entry, index) => {
                  let customColor = PIE_COLORS[index % PIE_COLORS.length];
                  if (chartType === 4 && entry.name === 'High') customColor = '#ef4444';
                  if (chartType === 4 && entry.name === 'Medium') customColor = '#f59e0b';
                  if (chartType === 4 && entry.name === 'Low') customColor = '#10b981';
                  if (chartType === 2 && entry.name.includes("Stale")) customColor = '#ef4444';
                  if (chartType === 2 && entry.name.includes("Active")) customColor = '#3b82f6';
                  if (chartType === 2 && entry.name.includes("New")) customColor = '#10b981';
                  
                  return <Cell key={`cell-${index}`} fill={customColor} />;
                })}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#111113', border: '1px solid #2a2d36', borderRadius: '4px' }}
                itemStyle={{ color: '#f8fafc', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Card Velocity */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("cardVelocity")}</h3>
            <span className="text-xs text-slate-500 font-medium">{t("lastWeek")}</span>
        </div>
        <div className="h-[140px] w-full pointer-events-auto">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={velocityData} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
              <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{fill: '#24272c'}}
                contentStyle={{ backgroundColor: '#111113', border: '1px solid #2a2d36', borderRadius: '4px' }}
                itemStyle={{ color: '#4fd1c5', fontSize: '12px' }}
              />
              <Bar dataKey="value" fill="#22d3ee" radius={[2, 2, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="flex flex-col gap-4 mt-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("statusBreakdown")}</h3>
        
        <div className="flex flex-col gap-1">
           <div className="flex justify-between text-xs font-semibold text-slate-300">
               <span>{t("statusCompleted")}</span>
               <span>{donePct}%</span>
           </div>
           <div className="w-full h-1.5 bg-[#252830] rounded-full overflow-hidden">
               <div className="h-full bg-[#10b981]" style={{ width: `${donePct}%` }}></div>
           </div>
        </div>

        <div className="flex flex-col gap-1">
           <div className="flex justify-between text-xs font-semibold text-slate-300">
               <span>{t("statusInProgress")}</span>
               <span>{progPct}%</span>
           </div>
           <div className="w-full h-1.5 bg-[#252830] rounded-full overflow-hidden">
               <div className="h-full bg-[#f59e0b]" style={{ width: `${progPct}%` }}></div>
           </div>
        </div>

        <div className="flex flex-col gap-1">
           <div className="flex justify-between text-xs font-semibold text-slate-300">
               <span>{t("statusToDo")}</span>
               <span>{todoPct}%</span>
           </div>
           <div className="w-full h-1.5 bg-[#252830] rounded-full overflow-hidden">
               <div className="h-full bg-[#3b82f6]" style={{ width: `${todoPct}%` }}></div>
           </div>
        </div>
        
      </div>

    </div>
  );
}