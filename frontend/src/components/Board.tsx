import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { arrayMove, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
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
import List from "./List";
import CardComp from "./Card";
import CardModal from "./CardModal";
import type { BoardType, Card, ListType } from "../types";
import { LogOut, Search, LayoutGrid, X, ArrowDownUp, Filter, MoreHorizontal, List as ListIcon, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import UserSettings from "./UserSettings";

let socket: Socket;

interface Props {
  token: string;
  onLogout: () => void;
}

export function Board({ token, onLogout }: Props) {
  const [board, setBoard] = useState<BoardType | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeList, setActiveList] = useState<ListType | null>(null);
  const [modalCard, setModalCard] = useState<Card | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");

  const { t, i18n } = useTranslation();

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

  const handleCreateTelemetry = async () => {
    if (!board) return;
    try {
      await fetch("http://localhost:3001/api/lists", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: "Analytics Overview", boardId: board.id, type: "TELEMETRY" }),
      });
      fetchBoard();
    } catch (err) {
      console.error(err);
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
    } else if (active.data.current?.type === "List") {
      setActiveList(active.data.current.list);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;

    if (!over || !board) {
      if (active.data.current?.type === "Card") {
        socket.emit("card:unlocked", active.id);
      }
      setActiveList(null);
      return;
    }

    if (active.data.current?.type === "List") {
      const activeId = String(active.id);
      const overId = String(over.id);
      if (activeId !== overId && over.data.current?.type === "List") {
        const oldIndex = board.lists.findIndex(l => l.id === activeId);
        const newIndex = board.lists.findIndex(l => l.id === overId);
        const updatedLists = arrayMove(board.lists, oldIndex, newIndex).map((l, i) => ({ ...l, order: i }));
        setBoard({ ...board, lists: updatedLists });
        socket.emit("lists:reordered", updatedLists.map(l => ({ id: l.id, order: l.order })));
      }
      setActiveList(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) {
      socket.emit("card:unlocked", activeId);
      return;
    }

    const activeCardData = active.data.current?.card as Card;
    const overDataType = over.data.current?.type;

    const sourceListIndex = board.lists.findIndex(l => l.id === activeCardData.listId);
    let destListIndex = -1;
    
    if (overDataType === "List") {
      destListIndex = board.lists.findIndex(l => l.id === overId);
    } else if (overDataType === "Card") {
      const overCardData = over.data.current?.card as Card;
      destListIndex = board.lists.findIndex(l => l.id === overCardData.listId);
    }

    if (sourceListIndex === -1 || destListIndex === -1) {
      socket.emit("card:unlocked", activeId);
      return;
    }

    const sourceList = board.lists[sourceListIndex];
    const destList = board.lists[destListIndex];

    const oldIndex = sourceList.cards.findIndex(c => c.id === activeId);
    let newIndex = -1;
    
    if (overDataType === "List") {
      newIndex = destList.cards.length;
    } else {
      newIndex = destList.cards.findIndex(c => c.id === overId);
      if (newIndex === -1) newIndex = destList.cards.length;
    }

    const p = { ...board, lists: [...board.lists] };
    let itemsToUpdate: {id: string, order: number, listId: string}[] = [];

    if (sourceListIndex === destListIndex) {
      const updatedCards = arrayMove(sourceList.cards, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }));
      p.lists[sourceListIndex] = { ...sourceList, cards: updatedCards };
      itemsToUpdate = updatedCards.map(c => ({ id: c.id, order: c.order, listId: c.listId }));
    } else {
      const sourceCards = [...sourceList.cards];
      const [movedCard] = sourceCards.splice(oldIndex, 1);
      
      const destCards = [...destList.cards];
      destCards.splice(newIndex, 0, { ...movedCard, listId: destList.id });
      
      const updatedSource = sourceCards.map((c, i) => ({ ...c, order: i }));
      const updatedDest = destCards.map((c, i) => ({ ...c, order: i }));
      
      p.lists[sourceListIndex] = { ...sourceList, cards: updatedSource };
      p.lists[destListIndex] = { ...destList, cards: updatedDest };
      
      itemsToUpdate = [
          ...updatedSource.map(c => ({ id: c.id, order: c.order, listId: c.listId })),
          ...updatedDest.map(c => ({ id: c.id, order: c.order, listId: c.listId }))
      ];
    }

    setBoard(p);

    socket.emit("cards:reordered", itemsToUpdate);
  };

  if (!board) {
    return (
      <div className="flex w-full h-screen items-center justify-center">
        <div className="animate-pulse text-xl text-slate-400 font-semibold tracking-wider">
          {t("loadingWorkspace")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#111113] text-slate-100 font-sans">
      {/* Top Navbar */}
      <nav className="h-14 border-b border-white/5 bg-[#17171a] flex items-center justify-between px-6 shrink-0 z-10 w-full relative">
        <div className="flex items-center gap-4">
          <div className="w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" placeholder={t("navbarSearch")} className="w-full bg-[#202127] border border-white/5 rounded-md py-1.5 pl-9 pr-4 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors" />
          </div>
        </div>
        <div className="flex items-center gap-4">
           <UserSettings board={board} />
        </div>
        
      </nav>

      {/* Header Context Action Bar */}
      <header className="px-8 pt-6 pb-4 flex flex-col gap-4 shrink-0 bg-[#111113]">
        <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
          <span><LayoutGrid className="inline w-3 h-3 mr-1"/>{t("dashboard")}</span> / <span className="text-slate-400">App</span> / <span className="text-slate-300">Sprint Board</span>
        </div>
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div className="flex flex-col gap-3">
             <h1 className="text-3xl font-bold text-white tracking-tight">{board?.title || "Sprint Board"}</h1>
             <div className="flex gap-2">
                <span className="text-xs font-medium bg-[#1e1e24] border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors shadow-sm tracking-wide">{t("yearFilter", {filter: "2026"})} <X size={12}/></span>
                <span className="text-xs font-medium bg-[#1e1e24] border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors shadow-sm tracking-wide">{t("taskProgressFilter", {filter: "All"})} <X size={12}/></span>
                <span className="text-xs font-medium bg-[#1e1e24] border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors shadow-sm tracking-wide">{t("statusFilter", {filter: "All"})} <X size={12}/></span>
             </div>
          </div>
          <div className="flex gap-2 items-center">
             <button className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-400 hover:text-slate-200 bg-transparent border border-white/10 hover:bg-white/5 transition-all">Progress type: Project</button>
             <button className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:text-white bg-[#1e1e24] border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"><ArrowDownUp size={14}/> {t("sort")}</button>
             <button className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:text-white bg-[#1e1e24] border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"><Filter size={14}/> {t("moreFilters")}</button>
             <button className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-400 hover:text-slate-200 bg-transparent border border-white/10 hover:bg-white/5 transition-all">Send Feedback</button>
             <button className="px-2 py-1.5 rounded-md text-xs font-semibold text-slate-400 hover:text-slate-200 bg-transparent border border-white/10 hover:bg-white/5 transition-all"><MoreHorizontal size={16}/></button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Fixed Palette */}
        <aside className="w-[300px] shrink-0 border-r border-[#202127] p-6 flex flex-col gap-4 overflow-y-auto bg-[#17171a]">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mt-2 mb-2">{t("addNewColumn")}</h3>
          
          {!isAddingList ? (
            <button onClick={() => setIsAddingList(true)} className="flex items-center justify-center gap-2 w-full py-3 bg-[#1e2333]/80 hover:bg-[#252b40] border border-[#2e3752] rounded-md text-[#7896ee] transition-all font-medium text-sm shadow-sm group">
                <ListIcon size={16} className="text-[#6082e6] group-hover:text-[#7896ee]"/> {t("taskList")}
            </button>
          ) : (
            <div className="bg-[#1e1e24] rounded-lg p-3 border border-[#2a2b36] shadow-lg mb-2">
                <form onSubmit={handleCreateList} className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder="Enter list title..."
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-white/10 rounded focus:outline-none focus:border-blue-500 text-slate-200 font-medium"
                    required
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button type="submit" className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded transition-colors w-full">
                      {t("addNewCardConfirm")}
                    </button>
                    <button type="button" onClick={() => setIsAddingList(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors w-full bg-[#111113] rounded border border-white/10 hover:border-white/20">
                      {t("addNewCardCancel")}
                    </button>
                  </div>
                </form>
            </div>
          )}

          <button onClick={handleCreateTelemetry} className="flex items-center justify-center gap-2 w-full py-3 bg-[#162728]/80 hover:bg-[#1a2f30] border border-[#234041] rounded-md text-[#4fd1c5] transition-all font-medium text-sm shadow-sm group">
              <TrendingUp size={16} className="text-[#3bbaa8] group-hover:text-[#4fd1c5]"/> {t("analyticsList")}
          </button>
          
          <div className="mt-8 flex justify-center">
             <button onClick={onLogout} className="text-xs font-semibold text-slate-500 flex items-center gap-2 hover:text-rose-400 transition-colors"><LogOut size={14}/> {t("signOut")}</button>
          </div>
        </aside>

        {/* Board DND Area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#111113] custom-scrollbar">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 p-6 items-start h-full w-max">
              <SortableContext items={board?.lists.map(l => l.id) || []} strategy={horizontalListSortingStrategy}>
                {board?.lists.map(list => (
                  <List 
                    key={list.id} 
                    list={list} 
                    cards={list.cards} 
                    currentSocketId={socketId} 
                    token={token} 
                    onAddCard={fetchBoard} 
                    onOpenModal={setModalCard}
                    boardCards={board?.lists.flatMap(l => l.cards) || []}
                    allLists={board?.lists || []}
                  />
                ))}
              </SortableContext>
            </div>
            <DragOverlay>
              {activeCard ? (
                <div className="rotate-3 scale-105 transition-transform shadow-2xl shadow-[#3b82f6]/20">
                  <CardComp card={activeCard} currentSocketId={socketId} token={token} onUpdate={() => {}} onOpenModal={() => {}} />
                </div>
              ) : activeList ? (
                <div className="rotate-3 scale-105 transition-transform shadow-2xl opacity-80">
                  <List 
                    list={activeList} 
                    cards={activeList.cards} 
                    currentSocketId={socketId} 
                    token={token} 
                    onAddCard={() => {}} 
                    boardCards={board?.lists.flatMap(l => l.cards) || []}
                    allLists={board?.lists || []}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>

      {modalCard && (
        <CardModal 
          card={modalCard} 
          token={token} 
          onClose={() => setModalCard(null)} 
          onUpdate={fetchBoard} 
          socket={socket} 
        />
      )}
    </div>
  );
}
