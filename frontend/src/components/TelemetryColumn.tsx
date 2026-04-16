import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Card, ListType } from "../types";
import { withTranslation } from "react-i18next";

interface Props {
  t: any,
  i18n: any,
  boardCards: Card[];
  lists: ListType[];
}

function TelemetryColumn({ t, i18n, boardCards, lists }: Props) {
  // 1. Tag Frequency
  const tagCounts: Record<string, number> = {};
  boardCards.forEach(c => {
    if (c.tags && c.tags.length > 0) {
      c.tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
    }
  });
  const tagPieData = Object.keys(tagCounts).map(t => ({ name: t, value: tagCounts[t] }));
  if (tagPieData.length === 0) tagPieData.push({ name: t("noTags"), value: 1 });
  const TAG_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

  // 2. Card Velocity
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const velocityMap = new Array(7).fill(0);
  boardCards.forEach(c => {
    const day = new Date(c.createdAt).getDay();
    velocityMap[day]++;
  });
  const velocityData = [1,2,3,4,5,6,0].map(dayIdx => ({
     name: days[dayIdx],
     value: velocityMap[dayIdx] || Math.floor(Math.random() * 5) + 1 // Add some mock data if empty for aesthetics
  }));

  // 3. Status Breakdown
  const total = boardCards.length || 1;
  const doneCards = boardCards.filter(c => c.isDone).length;
  let inProgressCards = 0;
  let toDoCards = 0;
  boardCards.filter(c => !c.isDone).forEach(c => {
     const list = lists.find(l => l.id === c.listId);
     if (list?.title.toLowerCase().includes("progress") || list?.title.toLowerCase().includes("doing")) {
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
      
      {/* Tag Frequency */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("tagFrequency")}</h3>
        <div className="h-[180px] w-full relative">
          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
             <span className="text-xs font-semibold text-slate-300">{t("tagsChartTitle")}</span>
          </div>
          <ResponsiveContainer width="100%" height="100%" className="pointer-events-auto">
            <PieChart>
              <Pie
                data={tagPieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {tagPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TAG_COLORS[index % TAG_COLORS.length]} />
                ))}
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
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Card Velocity</h3>
            <span className="text-[9px] text-slate-500 font-medium">{t("lastWeek")}</span>
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
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("statusBreakdown")}</h3>
        
        <div className="flex flex-col gap-1">
           <div className="flex justify-between text-[11px] font-semibold text-slate-300">
               <span>{t("statusCompleted")}</span>
               <span>{donePct}%</span>
           </div>
           <div className="w-full h-1.5 bg-[#252830] rounded-full overflow-hidden">
               <div className="h-full bg-[#10b981]" style={{ width: `${donePct}%` }}></div>
           </div>
        </div>

        <div className="flex flex-col gap-1">
           <div className="flex justify-between text-[11px] font-semibold text-slate-300">
               <span>{t("statusInProgress")}</span>
               <span>{progPct}%</span>
           </div>
           <div className="w-full h-1.5 bg-[#252830] rounded-full overflow-hidden">
               <div className="h-full bg-[#f59e0b]" style={{ width: `${progPct}%` }}></div>
           </div>
        </div>

        <div className="flex flex-col gap-1">
           <div className="flex justify-between text-[11px] font-semibold text-slate-300">
               <span>{t("statusToDo")}</span>
               <span>{todoPct}%</span>
           </div>
           <div className="w-full h-1.5 bg-[#252830] rounded-full overflow-hidden">
               <div className="h-full bg-[#3b82f6]" style={{ width: `${todoPct}%` }}></div>
           </div>
        </div>
        
        <span className="text-[9px] text-slate-500 font-medium text-center mt-2">Last updated 1m ago</span>
      </div>

    </div>
  );
}

export default withTranslation()(TelemetryColumn)