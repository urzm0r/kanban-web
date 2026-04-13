import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TaskCard } from "./TaskCard";
import type { ColumnType, Task } from "../types";

interface Props {
  column: ColumnType;
  tasks: Task[];
  currentSocketId: string | null;
}

export function Column({ column, tasks, currentSocketId }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  return (
    <div className={`flex flex-col bg-[#1e293b] w-[320px] min-w-[320px] h-[75vh] rounded-xl border transition-colors duration-200
      ${isOver ? 'border-[#3b82f6]/50 shadow-[#3b82f6]/10 shadow-lg' : 'border-slate-700'} 
      overflow-hidden shadow-md`}
    >
      <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between backdrop-blur-sm">
        <h2 className="font-bold text-md text-slate-100 uppercase tracking-wider">{column.title}</h2>
        <span className="bg-[#334155] text-xs font-bold px-2.5 py-1 rounded-full text-slate-300">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-col flex-grow p-3 gap-3 overflow-y-auto"
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} currentSocketId={currentSocketId} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
