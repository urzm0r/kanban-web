import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useParams, Link } from "react-router-dom";
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
import ShareModal from "./ShareModal";
import ConfirmModal from "./ConfirmModal";
import type { BoardActions, BoardType, Card, ListType } from "../types";
import { LogOut, Search, LayoutGrid, MoreHorizontal, List as ListIcon, TrendingUp, UserPlus, Trash2, Filter, BarChart3, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import UserSettings from "./UserSettings";
import { parseJwt } from "../lib/jwt";
import { API_URL } from "../lib/api";
import confetti from 'canvas-confetti';

interface Props {
  token: string;
  onLogout: () => void;
}

export function Board({ token, onLogout }: Props) {
  const { boardId } = useParams();
  const [board, setBoard] = useState<BoardType | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeList, setActiveList] = useState<ListType | null>(null);
  const [modalCard, setModalCard] = useState<Card | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [confettiEnabled, setConfettiEnabled] = useState(false);
  const [showClearCompletedConfirm, setShowClearCompletedConfirm] = useState(false);
  const [isEditingBoardTitle, setIsEditingBoardTitle] = useState(false);
  const [editedBoardTitle, setEditedBoardTitle] = useState("");
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const initialFetchOccurred = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  const [cardSearch, setCardSearch] = useState<string>("");
  const [cardSearchResults, setCardSearchResults] = useState<Card[]>([])

  const { t } = useTranslation();

  const currentUser = parseJwt(token);

  useEffect(() => {
    const socket = io(API_URL, {
      auth: { token }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to socket");
      if (boardId) socket.emit("join_board", boardId);
    });

    socket.on("board:updated", (updatedBoard: BoardType) => {
      setBoard(updatedBoard);
      setEditedBoardTitle(updatedBoard.title);
    });

    socket.on("card:locked", ({ cardId, lockedBy, lockedByName }) => {
      updateCardStatus(cardId, { lockedBy, lockedByName, lockedAt: new Date().toISOString() });
    });

    socket.on("card:unlocked", ({ cardId }) => {
      updateCardStatus(cardId, { lockedBy: null, lockedByName: null, lockedAt: null });
    });

    socket.on("list:created", (newList: ListType) => {
      setBoard((prev) => {
        if (!prev) return prev;
        if (prev.lists.some(l => l.id === newList.id)) return prev;
        return { ...prev, lists: [...prev.lists, newList].sort((a, b) => a.order - b.order) };
      });
    });

    socket.on("list:updated", (updatedList: ListType) => {
      setBoard((prev) => {
        if (!prev) return prev;
        return { ...prev, lists: prev.lists.map(l => l.id === updatedList.id ? updatedList : l) };
      });
    });

    socket.on("list:deleted", (listId: string) => {
      setBoard((prev) => {
        if (!prev) return prev;
        return { ...prev, lists: prev.lists.filter(l => l.id !== listId) };
      });
    });

    socket.on("cards:reordered", (items: any[]) => {
      setBoard((prev) => {
        if (!prev) return prev;
        const newLists = [...prev.lists];
        items.forEach((item: any) => {
          newLists.forEach((list, lIdx) => {
            const cardIdx = list.cards.findIndex(c => c.id === item.id);
            if (cardIdx !== -1) {
              const [card] = newLists[lIdx].cards.splice(cardIdx, 1);
              card.listId = item.listId;
              card.order = item.order;
              const destList = newLists.find(l => l.id === item.listId);
              if (destList) destList.cards.push(card);
            }
          });
        });
        return { ...prev, lists: newLists.map(l => ({ ...l, cards: [...l.cards].sort((a, b) => a.order - b.order) })) };
      });
    });

    socket.on("lists:reordered", (items: any[]) => {
      setBoard((prev) => {
        if (!prev) return prev;
        const updatedLists = prev.lists.map(l => {
          const item = items.find(i => i.id === l.id);
          return item ? { ...l, order: item.order } : l;
        }).sort((a, b) => a.order - b.order);
        return { ...prev, lists: updatedLists };
      });
    });

    socket.on("card:synced", (updatedCard: Card) => {
      setModalCard((prev) => {
        if (!prev) return prev;

        if (prev.id === updatedCard.id) return updatedCard;
        return prev;
      });
      setBoard((prev) => {
        if (!prev) return prev;
        let oldListId: string | null = null;
        let found = false;

        for (const list of prev.lists) {
          if (list.cards.some(c => c.id === updatedCard.id)) {
            oldListId = list.id;
            found = true;
            break;
          }
        }

        if (!found) {
          return {
            ...prev,
            lists: prev.lists.map(l => l.id === updatedCard.listId ? { ...l, cards: [...l.cards, updatedCard].sort((a, b) => a.order - b.order) } : l)
          };
        }

        if (oldListId && oldListId !== updatedCard.listId) {
          return {
            ...prev,
            lists: prev.lists.map(l => {
              if (l.id === oldListId) return { ...l, cards: l.cards.filter(c => c.id !== updatedCard.id) };
              if (l.id === updatedCard.listId) return { ...l, cards: [...l.cards, updatedCard].sort((a, b) => a.order - b.order) };
              return l;
            })
          };
        }

        return {
          ...prev,
          lists: prev.lists.map(l => ({
            ...l,
            cards: l.cards.map(c => c.id === updatedCard.id ? updatedCard : c)
          }))
        };
      });
    });

    socket.on("card:deleted", (cardId: string) => {
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lists: prev.lists.map(l => ({
            ...l,
            cards: l.cards.filter(c => c.id !== cardId)
          }))
        };
      });
    });

    if (!initialFetchOccurred.current && boardId) {
      fetchBoard(boardId);
      initialFetchOccurred.current = true;
    }

    return () => {
      socket.disconnect();
    };
  }, [token, boardId]);

  const fetchBoard = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/boards/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) return onLogout();
      if (!res.ok) throw new Error("Board not found");
      const fullBoard = await res.json();
      setBoard(fullBoard);
      setEditedBoardTitle(fullBoard.title);
    } catch {
      console.error("Fetch board error");
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

  const handleUpdateBoardTitle = async () => {
    if (!editedBoardTitle.trim() || !board || editedBoardTitle === board.title) {
      setIsEditingBoardTitle(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/boards/${board.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editedBoardTitle })
      });
      if (res.ok) {
        const updated = await res.json();
        setBoard(updated);
        setIsEditingBoardTitle(false);
      }
    } catch {
      console.error("Failed to update board title");
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim() || !board) return;

    try {
      await fetch(`${API_URL}/api/lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: newListTitle, boardId: board.id }),
      });
      setNewListTitle("");
      setIsAddingList(false);
    } catch {
      console.error("Failed to add list");
    }
  };

  const handleCreateTelemetry = async () => {
    if (!board) return;
    try {
      await fetch(`${API_URL}/api/lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: "Analytics Overview", boardId: board.id, type: "TELEMETRY" }),
      });
      // No manual fetchBoard() here - socket handles it
    } catch {
      console.error("Failed to create telemetry");
    }
  };

  const handleClearCompleted = async () => {
    if (!board) return;
    const completedCards = board.lists.flatMap(l => l.cards).filter(c => c.isDone);
    if (completedCards.length === 0) return;

    try {
      for (const card of completedCards) {
        await fetch(`${API_URL}/api/cards/${card.id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
      }
      // Refresh board data
      const res = await fetch(`${API_URL}/api/boards/${boardId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setBoard(data);
      setShowClearCompletedConfirm(false);
      setShowMoreMenu(false);
    } catch (err) {
      console.error("Error clearing completed cards:", err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const { active } = e;
    if (active.data.current?.type === "Card") {
      setActiveCard(active.data.current.card);
      socketRef.current?.emit("card:locked", { cardId: active.id, boardId });
    } else if (active.data.current?.type === "List") {
      setActiveList(active.data.current.list);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;

    if (!over || !board) {
      if (active.data.current?.type === "Card") {
        socketRef.current?.emit("card:unlocked", { cardId: active.id, boardId });
      }
      setActiveList(null);
      return;
    }

    // handle drag & drop of a list
    if (active.data.current?.type === "List") {
      const activeId = String(active.id);
      const overId = String(over.id);
      if (activeId !== overId && over.data.current?.type === "List") {
        const oldIndex = board.lists.findIndex(l => l.id === activeId);
        const newIndex = board.lists.findIndex(l => l.id === overId);
        const updatedLists = arrayMove(board.lists, oldIndex, newIndex).map((l, i) => ({ ...l, order: i }));
        setBoard({ ...board, lists: updatedLists });
        socketRef.current?.emit("lists:reordered", { items: updatedLists.map(l => ({ id: l.id, order: l.order })), boardId });
      }
      setActiveList(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) {
      socketRef.current?.emit("card:unlocked", { cardId: activeId, boardId });
      return;
    }

    const overDataType = over.data.current?.type;

    let destListIndex = -1;

    if (overDataType === "List") {
      destListIndex = board.lists.findIndex(l => l.id === overId);
    } else if (overDataType === "Card") {
      const overCardData = over.data.current?.card as Card;
      destListIndex = board.lists.findIndex(l => l.id === overCardData.listId);
    }

    let newIndex = -1;
    const destList = board.lists[destListIndex];

    if (overDataType === "List") {
      newIndex = destList.cards.length;
    } else {
      newIndex = destList.cards.findIndex(c => c.id === overId);
      if (newIndex === -1) newIndex = destList.cards.length;
    }

    if (activeCard) moveCard(activeCard, destListIndex, newIndex);
  };

  const moveListByOffset = (listId: string, offset: number) => {
    if (!board) return;
    const oldIndex = board.lists.findIndex(l => l.id === listId);
    const newIndex = oldIndex + offset;
    if (newIndex < 0 || newIndex >= board.lists.length) return;

    const updatedLists = arrayMove(board.lists, oldIndex, newIndex).map((l, i) => ({ ...l, order: i }));
    setBoard({ ...board, lists: updatedLists } as BoardType);
    socketRef.current?.emit("lists:reordered", { items: updatedLists.map(l => ({ id: l.id, order: l.order })), boardId });
  }

  const moveCardByOffset = (card: Card, listOffset: number, cardOffset: number) => {
    if (!board) return;
    const sourceListIndex = board.lists.findIndex(l => l.id === card.listId);

    let destListIndex: number = sourceListIndex;

    if (listOffset !== 0) {
      for (let i = sourceListIndex + listOffset;
        i >= 0 && i < board.lists.length;
        i += Math.sign(listOffset)
      ) {
        if (board.lists[i].type === "DEFAULT") {
          destListIndex = i;
          break;
        }
      }
    }

    const destCardIndex = Math.max(0, card.order + cardOffset);

    moveCard(card, destListIndex, destCardIndex)
  }

  const actions: BoardActions = {
    moveListByOffset: moveListByOffset,
    moveCardByOffset: moveCardByOffset
  }

  const moveCard = (card: Card, destListIndex: number, destCardIndex: number) => {
    if (!board) return;
    const cardId = card.id;
    const sourceListIndex = board.lists.findIndex(l => l.id === card.listId);

    if (sourceListIndex === -1 || destListIndex === -1 || board.lists[destListIndex].type !== "DEFAULT") {
      socketRef.current?.emit("card:unlocked", { cardId, boardId });
      return;
    }

    const sourceList = board.lists[sourceListIndex];
    const destList = board.lists[destListIndex];

    const oldIndex = sourceList.cards.findIndex(c => c.id === cardId);


    const p = { ...board, lists: [...board.lists] };
    let itemsToUpdate: { id: string, order: number, listId: string }[] = [];

    if (sourceListIndex === destListIndex) {
      const updatedCards = arrayMove(sourceList.cards, oldIndex, destCardIndex).map((c, i) => ({ ...c, order: i }));
      p.lists[sourceListIndex] = { ...sourceList, cards: updatedCards };
      itemsToUpdate = updatedCards.map(c => ({ id: c.id, order: c.order, listId: c.listId }));
    } else {
      const sourceCards = [...sourceList.cards];
      const [movedCard] = sourceCards.splice(oldIndex, 1);

      const destCards = [...destList.cards];
      destCards.splice(destCardIndex, 0, { ...movedCard, listId: destList.id });

      const updatedSource = sourceCards.map((c, i) => ({ ...c, order: i }));
      const updatedDest = destCards.map((c, i) => ({ ...c, order: i }));

      p.lists[sourceListIndex] = { ...sourceList, cards: updatedSource };
      p.lists[destListIndex] = { ...destList, cards: updatedDest };

      itemsToUpdate = [
        ...updatedSource.map(c => ({ id: c.id, order: c.order, listId: c.listId })),
        ...updatedDest.map(c => ({ id: c.id, order: c.order, listId: c.listId }))
      ];
    }

    setBoard(p as BoardType);

    socketRef.current?.emit("cards:reordered", { items: itemsToUpdate, boardId });
  }

  if (!board) {
    return (
      <div className="flex w-full h-screen items-center justify-center bg-[#111113]">
        <div className="animate-pulse text-xl text-slate-500 font-bold uppercase tracking-widest">
          {t("loadingWorkspace")}
        </div>
      </div>
    );
  }

  const fetchCardSearchResults = async (query: string) => {
    try {
      let request = `${API_URL}/api/cards/search?q=${query}&board=${boardId}`;

      const res = await fetch(request, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setCardSearchResults(data);
    } catch (err) {
      console.error("Search error:", err);
    }
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#111113] text-slate-100 font-sans">
      {/* Top Navbar */}
      <nav className="h-14 border-b border-white/5 bg-[#17171a] flex items-center justify-between px-6 shrink-0 z-10 w-full relative">
        <div className="flex items-center gap-4">
          <div className="w-[300px] relative">
            {/* Card Search */}
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={cardSearch}
              onChange={e => { setCardSearch(e.target.value); fetchCardSearchResults(e.target.value.trim()) }}
              placeholder={t("navbarSearch")}
              className="w-full bg-[#202127] border border-white/5 rounded-md py-1.5 pl-9 pr-4 text-[15px] text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        </div>
        {cardSearch && (
          <div className="absolute top-12 left-6 bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl z-[299] min-w-[300px]">
            {cardSearchResults.length == 0 ? (
              <p className="text-slate-300 m-4">{t("noResultsFound")}</p>
            ) : (
              <div className="flex gap-2 overflow-hidden flex-col">
                {cardSearchResults.map(result => (
                  // Card search result item
                  <button
                    id={result.id}
                    className="hover:bg-white/10 focus:bg-white/10 outline-none p-4 pb-2 pt-2 text-left font-bold text-[14px] truncate w-full"
                    key={result.id}
                    onClick={() => {
                      setModalCard(result);
                      setCardSearch("");
                    }}
                  >{result.content}</button>
                ))}
              </div>
            )
            }
          </div>
        )}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 pr-4 border-r border-white/10">
            <span className="text-[15px] font-semibold text-slate-300">
              {currentUser?.name || "User"}
            </span>
            <UserSettings board={board} user={currentUser} />
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e24] border border-white/5 hover:bg-white/5 rounded-md text-[15px] text-slate-400 hover:text-slate-200 transition-all font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {t("signOut")}
          </button>
        </div>

      </nav>

      {/* Header Context Action Bar */}
      <header className="px-8 pt-6 pb-4 flex flex-col gap-4 shrink-0 bg-[#111113]">
        <div className="text-sm text-slate-500 font-medium flex items-center gap-2">
          <Link to="/dashboard" className="hover:text-blue-400 transition-colors flex items-center gap-1">
            <LayoutGrid className="w-3 h-3" />
            {t("dashboard")}
          </Link>
          <span>/</span>
          <span className="text-slate-300">{board?.title}</span>
        </div>
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div className="flex flex-col gap-3 min-w-0 max-w-full group">
            {isEditingBoardTitle ? (
              <div className="flex items-center gap-3">
                <input
                  autoFocus
                  maxLength={50}
                  className="text-4xl font-bold text-white bg-[#15161a] border border-blue-500 rounded-lg px-3 py-1 focus:outline-none w-full"
                  value={editedBoardTitle}
                  onChange={(e) => setEditedBoardTitle(e.target.value)}
                  onBlur={handleUpdateBoardTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateBoardTitle();
                    if (e.key === 'Escape') {
                      setEditedBoardTitle(board.title);
                      setIsEditingBoardTitle(false);
                    }
                  }}
                />
              </div>
            ) : (
              <h1
                onClick={() => board.ownerId === currentUser?.userId && setIsEditingBoardTitle(true)}
                className={`text-4xl font-bold text-white tracking-tight break-words whitespace-pre-wrap ${board.ownerId === currentUser?.userId ? 'cursor-pointer hover:text-blue-400' : ''} transition-colors flex items-center gap-3`}
              >
                {board?.title}
                {board.ownerId === currentUser?.userId && (
                  <Pencil size={20} className="opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity translate-y-1" />
                )}
              </h1>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {board.ownerId === currentUser?.userId && (
              <button
                onClick={() => setShowShareModal(true)}
                className="px-3 py-1.5 rounded-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 cursor-pointer"
              >
                <UserPlus size={16} /> {t("share")}
              </button>
            )}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-all border cursor-pointer relative ${showMoreMenu ? 'text-blue-400 border-blue-500/50 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 bg-transparent border-white/10 hover:bg-white/5'}`}
              >
                <MoreHorizontal size={16} />
                {filterPriority.length > 0 && (
                  <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-[#111113] ${filterPriority.includes('High') ? 'bg-rose-500' :
                    filterPriority.includes('Medium') ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`} />
                )}
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-4 w-64 bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl z-[100] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("boardActions") || "Board Actions"}</div>

                  <button
                    onClick={() => { setShowSidebar(!showSidebar); setShowMoreMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                  >
                    <LayoutGrid size={16} className="text-blue-400" />
                    {showSidebar ? t("hideSidebar") : t("showSidebar")}
                  </button>

                  <div className="w-full px-4 py-2.5 flex items-center justify-between group">
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                      {t("confettiEffects") || "Confetti Effects"}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfettiEnabled(!confettiEnabled); }}
                      className={`w-9 h-5 rounded-full relative transition-all duration-300 cursor-pointer ${confettiEnabled ? 'bg-blue-600 shadow-lg shadow-blue-900/30' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${confettiEnabled ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>

                  <div className="h-px bg-white/5 my-2" />
                  <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("filters") || "Filters"}</div>

                  {['High', 'Medium', 'Low'].map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        setFilterPriority(prev =>
                          prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                        );
                      }}
                      className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors flex items-center justify-between ${filterPriority.includes(p) ? (p === 'High' ? 'bg-rose-500/10 text-rose-400' : p === 'Medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400') : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Filter size={16} className={filterPriority.includes(p) ? (p === 'High' ? 'text-rose-500' : p === 'Medium' ? 'text-amber-500' : 'text-emerald-500') : 'text-slate-500'} />
                        {t(`filter${p}`) || `Only ${p} Priority`}
                      </div>
                      {filterPriority.includes(p) && <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${p === 'High' ? 'bg-rose-500' : p === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />}
                    </button>
                  ))}

                  {filterPriority.length > 0 && (
                    <button
                      onClick={() => { setFilterPriority([]); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors pl-11"
                    >
                      {t("clearFilters") || "Clear all filters"}
                    </button>
                  )}

                  <div className="h-px bg-white/5 my-2" />

                  <button
                    onClick={() => { setShowClearCompletedConfirm(true); setShowMoreMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-3"
                  >
                    <Trash2 size={16} />
                    {t("clearCompleted")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Fixed Palette */}
        {showSidebar && (
          <aside className="w-[300px] shrink-0 border-r border-[#202127] p-6 flex flex-col gap-4 overflow-y-auto bg-[#17171a] animate-in slide-in-from-left duration-300">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center mt-2 mb-2">{t("addNewColumn")}</h3>

            {!isAddingList ? (
              <button onClick={() => setIsAddingList(true)} className="flex items-center justify-center gap-2 w-full py-3 bg-[#1e2333]/80 hover:bg-[#252b40] border border-[#2e3752] rounded-md text-[#7896ee] transition-all font-medium text-[15px] shadow-sm group cursor-pointer">
                <ListIcon size={16} className="text-[#6082e6] group-hover:text-[#7896ee]" /> {t("taskList")}
              </button>
            ) : (
              <div className="bg-[#1e1e24] rounded-lg p-3 border border-[#2a2b36] shadow-lg mb-2">
                <form onSubmit={handleCreateList} className="flex flex-col gap-2">
                  <input
                    autoFocus
                    maxLength={40}
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder={t("enterListTitle")}
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-white/10 rounded focus:outline-none focus:border-blue-500 text-slate-200 font-medium"
                    required
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button type="submit" className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded transition-colors w-full cursor-pointer">
                      {t("add")}
                    </button>
                    <button type="button" onClick={() => setIsAddingList(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors w-full bg-[#111113] rounded border border-white/10 hover:border-white/20 cursor-pointer">
                      {t("addNewCardCancel")}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <button onClick={handleCreateTelemetry} className="flex items-center justify-center gap-2 w-full py-3 bg-[#162728]/80 hover:bg-[#1a2f30] border border-[#234041] rounded-md text-[#4fd1c5] transition-all font-medium text-sm shadow-sm group cursor-pointer">
              <TrendingUp size={16} className="text-[#3bbaa8] group-hover:text-[#4fd1c5]" /> {t("analyticsList")}
            </button>


          </aside>
        )}

        {/* Board DND Area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#111113] custom-scrollbar">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 px-6 items-start h-full w-max">
              <SortableContext items={board?.lists.map(l => l.id) || []} strategy={horizontalListSortingStrategy}>
                {board?.lists.map(list => (
                  <List
                    key={list.id}
                    list={list}
                    cards={filterPriority.length > 0 ? list.cards.filter(c => filterPriority.includes(c.priority)) : list.cards}
                    currentSocketId={currentUser?.userId}
                    token={token}
                    confettiEnabled={confettiEnabled}
                    onAddCard={() => { }}
                    onOpenModal={setModalCard}
                    boardCards={board?.lists.flatMap(l => l.cards) || []}
                    allLists={board?.lists || []}
                    actions={actions}
                  />
                ))}
              </SortableContext>
            </div>
            <DragOverlay>
              {activeCard ? (
                <div className="rotate-3 scale-105 transition-transform shadow-2xl shadow-[#3b82f6]/20">
                  <CardComp card={activeCard} currentSocketId={currentUser?.userId} token={token} onUpdate={() => { }} onOpenModal={() => { }} actions={actions} />
                </div>
              ) : activeList ? (
                <div className="rotate-3 scale-105 transition-transform shadow-2xl opacity-80">
                  <List
                    list={activeList}
                    cards={activeList.cards}
                    currentSocketId={currentUser?.userId}
                    token={token}
                    onAddCard={() => { }}
                    boardCards={board?.lists.flatMap(l => l.cards) || []}
                    allLists={board?.lists || []}
                    actions={actions}
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
          onUpdate={() => { }}
          socket={socketRef.current}
          boardId={boardId || ""}
        />
      )}

      {showShareModal && board && (
        <ShareModal
          boardId={board.id}
          token={token}
          onClose={() => setShowShareModal(false)}
        />
      )}

      <ConfirmModal
        isOpen={showClearCompletedConfirm}
        title={t("clearCompleted") || "Clear Completed Cards"}
        message={t("clearCompletedConfirm") || "Are you sure you want to delete all completed cards? This action cannot be undone."}
        onConfirm={handleClearCompleted}
        onCancel={() => setShowClearCompletedConfirm(false)}
        confirmText={t("confirm")}
        cancelText={t("cancel")}
      />
    </div>
  );
}
