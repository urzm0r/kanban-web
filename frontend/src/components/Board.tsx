import { useState, useEffect } from "react";
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
import { List } from "./List";
import { Card as CardComp } from "./Card";
import type { BoardType, Card } from "../types";
import { LogOut, Plus } from "lucide-react";

let socket: Socket;

interface Props {
  token: string;
  onLogout: () => void;
}

export function Board({ token, onLogout }: Props) {
  const [board, setBoard] = useState<BoardType | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");

  useEffect(() => {
    socket = io("http://localhost:3001");

    socket.on("connect", () => {
      setSocketId(socket.id || null);
    });

    socket.on("card:locked", ({ cardId, lockedBy }) => {
      updateCardStatus(cardId, { lockedBy, lockedAt: new Date().toISOString() });
    });

    socket.on("card:unlocked", ({ cardId }) => {
      updateCardStatus(cardId, { lockedBy: null, lockedAt: null });
    });

    socket.on("card:moved", () => {
      fetchBoard();
    });

    socket.on("card:unlocked_all", () => {
      fetchBoard();
    });

    socket.on("board:updated", () => {
      fetchBoard();
    });

    fetchBoard();

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const fetchBoard = async () => {
    try {
      const res = await fetch("http://localhost:3001/boards", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) return onLogout();
      const data = await res.json();
      if (data && data.length > 0) {
        setBoard(data[0]);
      }
    } catch (e) {
      console.error("Fetch board error:", e);
    }
  };

  const updateCardStatus = (cardId: string, updates: Partial<Card>) => {
    setBoard((prev) => {
      if (!prev) return prev;
      const newLists = prev.lists.map(list => ({
        ...list,
        cards: list.cards.map(c => c.id === cardId ? { ...c, ...updates } : c)
      }));
      return { ...prev, lists: newLists };
    });
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim() || !board) return;
    
    try {
      await fetch("http://localhost:3001/api/lists", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: newListTitle, boardId: board.id }),
      });
      setNewListTitle("");
      setIsAddingList(false);
      fetchBoard();
    } catch (err) {
      console.error("Failed to add list", err);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const { active } = e;
    if (active.data.current?.type === "Card") {
      setActiveCard(active.data.current.card);
      socket.emit("card:locked", active.id);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;

    if (!over) {
      if (active.data.current?.type === "Card") {
        socket.emit("card:unlocked", active.id);
      }
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) {
      socket.emit("card:unlocked", activeId);
      return;
    }

    const activeCardData = active.data.current?.card as Card;
    const overDataType = over.data.current?.type;
    let newListId = activeCardData.listId;

    if (overDataType === "List") {
      newListId = String(overId);
    } else if (overDataType === "Card") {
      newListId = over.data.current?.card.listId;
    }

    // Optymistyczna synchronizacja przed siecią
    setBoard(prev => {
      if (!prev) return prev;
      let p = { ...prev, lists: [...prev.lists] };
      return p;
    });

    socket.emit("card:moved", {
      cardId: activeId,
      newListId,
      newOrder: 0
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
      <header className="p-6 border-b border-slate-800 bg-[#0f172a] flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            {board?.title || "Kanban Project"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Live collaborative view</p>
        </div>
        <button 
          onClick={onLogout} 
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
        >
          <LogOut size={16} /> Logout
        </button>
      </header>

      <main className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 p-8 items-start h-full w-max">
            {board?.lists.map(list => (
              <List key={list.id} list={list} cards={list.cards} currentSocketId={socketId} token={token} onAddCard={fetchBoard} />
            ))}
            
            {/* Add New List Button */}
            {!isAddingList ? (
              <button 
                onClick={() => setIsAddingList(true)}
                className="flex items-center gap-2 shrink-0 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl w-[320px] p-4 text-slate-300 transition-colors"
              >
                <Plus size={20} /> <span className="font-medium">Add another list</span>
              </button>
            ) : (
           	<div className="shrink-0 bg-[#1e293b] rounded-xl w-[320px] p-3 border border-slate-700 shadow-lg">
                <form onSubmit={handleCreateList} className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder="Enter list title..."
                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors">
                      Add list
                    </button>
                    <button type="button" onClick={() => setIsAddingList(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
            
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="rotate-3 scale-105 transition-transform shadow-2xl shadow-[#3b82f6]/20">
                <CardComp card={activeCard} currentSocketId={socketId} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
