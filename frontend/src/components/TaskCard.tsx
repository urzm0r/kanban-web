import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lock } from "lucide-react";
import type { Task } from "../types";

interface Props {
  task: Task;
  currentSocketId: string | null;
}

export function TaskCard({ task, currentSocketId }: Props) {
  // Task jest zablokowany jeśli ma ustalone lockedBy i to lockedBy nie jest naszym socketID
  const isLockedByOther = task.lockedBy !== null && task.lockedBy !== currentSocketId;

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
    disabled: isLockedByOther,
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-slate-700/50 outline outline-2 outline-[#3b82f6] rounded-md h-[50px] opacity-40"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isLockedByOther ? {} : listeners)} // wyłączlisteners dla zablokowanych
      className={`relative group flex flex-col p-3 rounded-lg shadow-md border 
        ${isLockedByOther ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-[#334155] border-transparent hover:border-[#3b82f6] hover:shadow-[#3b82f6]/20 cursor-grab active:cursor-grabbing'}
        transition-all duration-200`}
    >
      <div className="flex justify-between items-start gap-2">
        <p className={`text-sm ${isLockedByOther ? 'text-slate-500' : 'text-[#f8fafc]'}`}>
          {task.content}
        </p>

        {isLockedByOther && (
          <div title="Zadanie używane przez innego użytkownika" className="text-rose-500 animate-pulse">
            <Lock size={16} />
          </div>
        )}
      </div>

    </div>
  );
}
