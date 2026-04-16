import { useState } from "react";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card as CardComp } from "./Card";
import type { ListType, Card } from "../types";
import { Plus, Pencil, Trash, X, Check } from "lucide-react";
import { TelemetryColumn } from "./TelemetryColumn";

interface Props {
  list: ListType;
  cards: Card[];
  currentSocketId: string | null;
  token: string;
  onAddCard: () => void;
  onOpenModal?: (card: Card) => void;
  boardCards?: Card[];
  allLists?: ListType[];
}

export function List({ list, cards, currentSocketId, token, onAddCard, onOpenModal, boardCards, allLists }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCardContent, setNewCardContent] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);

  const { setNodeRef, isOver, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: {
      type: "List",
      list,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardContent.trim()) return;

    try {
      await fetch("http://localhost:3001/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newCardContent, listId: list.id })
      });
      setNewCardContent("");
      setIsAdding(false);
      onAddCard();
    } catch (e) {
      console.error("Failed to add card", e);
    }
  };

  const handleUpdateTitle = async () => {
    if (!editedTitle.trim() || editedTitle === list.title) {
        setIsEditingTitle(false);
        setEditedTitle(list.title);
        return;
    }
    try {
      await fetch(`http://localhost:3001/api/lists/${list.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: editedTitle })
      });
      setIsEditingTitle(false);
      onAddCard();
    } catch (e) {
      console.error("Failed to update title", e);
    }
  };

  const handleDeleteList = async () => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę listę i wszystkie jej karty?")) return;
    try {
      await fetch(`http://localhost:3001/api/lists/${list.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      onAddCard();
    } catch (e) {
      console.error("Failed to delete list", e);
    }
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`flex flex-col bg-[#1a1c20] w-[320px] min-w-[320px] h-[75vh] rounded-md border transition-all duration-200
      ${isOver ? 'border-[#3b82f6]/50 shadow-[#3b82f6]/10 shadow-lg' : isDragging ? 'opacity-40 border-[#3b82f6]' : 'border-[#26282e]'} 
      overflow-hidden shadow-sm`}
    >
      {/* Header */}
      <div 
        {...attributes}
        {...listeners}
        className="px-4 py-3 bg-[#1a1c20] flex items-center justify-between group cursor-grab active:cursor-grabbing shrink-0"
      >
        {isEditingTitle ? (
          <div className="flex items-center gap-2 flex-grow mr-2">
            <input 
              autoFocus
              className="flex-grow px-2 py-1 text-sm font-bold bg-[#111113] text-slate-100 border border-blue-500 rounded focus:outline-none"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
            />
            <button onClick={handleUpdateTitle} className="text-[#3bbaa8] hover:text-[#4fd1c5]">
                <Check size={16} />
            </button>
            <button onClick={() => { setIsEditingTitle(false); setEditedTitle(list.title); }} className="text-slate-400 hover:text-slate-200">
                <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-grow">
              <div className="flex items-center gap-2">
                {list.type !== "TELEMETRY" && (
                   <span className={`w-2.5 h-2.5 rounded-full ${list.title.toLowerCase().includes("done") ? "bg-[#3bbaa8]" : "bg-[#6082e6]"}`}></span>
                )}
                <h2 className="font-semibold text-[15px] text-slate-200">{list.title}</h2>
                <span className="bg-[#24272c] text-[11px] font-bold px-2 py-0.5 rounded flex items-center justify-center text-slate-400">
                  {cards.length}
                </span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                <button onClick={() => setIsEditingTitle(true)} className="text-[#24272c] hover:text-[#6082e6] transition-colors">
                    <Pencil size={14} />
                </button>
                <button onClick={handleDeleteList} className="text-[#24272c] hover:text-rose-400 transition-colors">
                    <Trash size={14} />
                </button>
              </div>
          </div>
        )}
      </div>

      {list.type === "TELEMETRY" ? (
          <TelemetryColumn boardCards={boardCards || []} lists={allLists || []} />
      ) : (
          <div className="flex flex-col flex-grow overflow-hidden cursor-default border-t border-[#26282e]" onPointerDown={e => e.stopPropagation()}>
            {/* List content */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar">
              <SortableContext items={cards.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {cards.map(card => (
                  <CardComp key={card.id} card={card} currentSocketId={currentSocketId} token={token} onUpdate={onAddCard} onOpenModal={onOpenModal!} />
                ))}
              </SortableContext>
            </div>
            
            {/* Footer */}
            <div className="px-3 pb-3 pt-1 shrink-0">
              {!isAdding ? (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="flex items-center justify-center gap-2 w-full p-2 rounded-md text-sm font-semibold text-slate-500 hover:bg-[#202127] hover:text-[#7896ee] transition-all"
                >
                  <Plus size={16} /> Add Card
                </button>
              ) : (
                <form onSubmit={handleAddCard} className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={newCardContent}
                    onChange={e => setNewCardContent(e.target.value)}
                    placeholder="Enter task title..."
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-white/10 rounded focus:outline-none focus:border-blue-500/50 text-slate-200 resize-none font-medium"
                    rows={3}
                    required
                  />
                  <div className="flex items-center gap-2">
                    <button type="submit" className="px-3 py-1.5 text-xs bg-[#7896ee]/10 hover:bg-[#7896ee]/20 text-[#7896ee] font-semibold border border-[#7896ee]/20 rounded transition-colors w-full">
                      Add
                    </button>
                    <button type="button" onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-[#1e2025] hover:bg-[#25282d] border border-white/5 rounded transition-colors w-full">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
      )}
    </div>
  );
}
