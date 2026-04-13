import { useState, useEffect, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import type { BoardType, Task } from "../types";

let socket: Socket;

export function Board() {
  const [board, setBoard] = useState<BoardType | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    socket = io("http://localhost:3001");

    socket.on("connect", () => {
      setSocketId(socket.id || null);
    });

    socket.on("task:locked", ({ taskId, lockedBy }) => {
      updateTaskStatus(taskId, { lockedBy, lockedAt: new Date().toISOString() });
    });

    socket.on("task:unlocked", ({ taskId }) => {
      updateTaskStatus(taskId, { lockedBy: null, lockedAt: null });
    });

    socket.on("task:moved", () => {
      fetchBoard();
    });

    socket.on("task:unlocked_all", () => {
      fetchBoard();
    });

    fetchBoard();

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchBoard = async () => {
    try {
      const res = await fetch("http://localhost:3001/boards");
      const data = await res.json();
      if (data && data.length > 0) {
        setBoard(data[0]);
      }
    } catch (e) {
      console.error("Fetch board error:", e);
    }
  };

  const updateTaskStatus = (taskId: string, updates: Partial<Task>) => {
    setBoard((prev) => {
      if (!prev) return prev;
      const newColumns = prev.columns.map(col => ({
        ...col,
        tasks: col.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      }));
      return { ...prev, columns: newColumns };
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const { active } = e;
    if (active.data.current?.type === "Task") {
      setActiveTask(active.data.current.task);
      socket.emit("task:locked", active.id);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;

    if (!over) {
      if (active.data.current?.type === "Task") {
        socket.emit("task:unlocked", active.id);
      }
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) {
      socket.emit("task:unlocked", activeId);
      return;
    }

    const activeTaskData = active.data.current?.task as Task;
    const overDataType = over.data.current?.type;
    let newColumnId = activeTaskData.columnId;

    if (overDataType === "Column") {
      newColumnId = String(overId);
    } else if (overDataType === "Task") {
      newColumnId = over.data.current?.task.columnId;
    }

    // Optymistyczna synchronizacja przed siecią
    setBoard(prev => {
      if (!prev) return prev;
      let p = { ...prev, columns: [...prev.columns] };
      return p;
    });

    socket.emit("task:moved", {
      taskId: activeId,
      newColumnId,
      newOrder: 0 // Uproszczenie kolejności wizualnej
    });

    setTimeout(() => fetchBoard(), 100);
  };

  if (!board) {
    return (
      <div className="flex w-full h-screen items-center justify-center">
        <div className="animate-pulse text-xl text-slate-400 font-semibold tracking-wider">
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f172a] text-slate-100 font-sans">
      <header className="p-6 border-b border-slate-800 bg-[#0f172a]">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          {board?.title || "Kanban Project"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Live collaborative view</p>
      </header>

      <main className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 p-8 items-start h-full w-max">
            {board?.columns.map(col => (
              <Column key={col.id} column={col} tasks={col.tasks} currentSocketId={socketId} />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rotate-3 scale-105 transition-transform shadow-2xl shadow-[#3b82f6]/20">
                <TaskCard task={activeTask} currentSocketId={socketId} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
