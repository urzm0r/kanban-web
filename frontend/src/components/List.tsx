import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Card as CardComp } from "./Card";
import type { ListType, Card } from "../types";
import { Plus } from "lucide-react";

interface Props {
  list: ListType;
  cards: Card[];
  currentSocketId: string | null;
  token: string;
  onAddCard: () => void;
}

export function List({ list, cards, currentSocketId, token, onAddCard }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCardContent, setNewCardContent] = useState("");

  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    data: {
      type: "List",
      list,
    },
  });

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

  return (
    <div className={`flex flex-col bg-[#1e293b] w-[320px] min-w-[320px] h-[75vh] rounded-xl border transition-colors duration-200
      ${isOver ? 'border-[#3b82f6]/50 shadow-[#3b82f6]/10 shadow-lg' : 'border-slate-700'} 
      overflow-hidden shadow-md`}
    >
      <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between backdrop-blur-sm">
        <h2 className="font-bold text-md text-slate-100 uppercase tracking-wider">{list.title}</h2>
        <span className="bg-[#334155] text-xs font-bold px-2.5 py-1 rounded-full text-slate-300">
          {cards.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-col flex-grow p-3 gap-3 overflow-y-auto"
      >
        <SortableContext items={cards.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <CardComp key={card.id} card={card} currentSocketId={currentSocketId} />
          ))}
        </SortableContext>
        
        {/* Add Card Form inside List */}
        {!isAdding ? (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 mt-2 p-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <Plus size={16} /> Add a card
          </button>
        ) : (
          <form onSubmit={handleAddCard} className="mt-2 flex flex-col gap-2">
            <textarea
              autoFocus
              value={newCardContent}
              onChange={e => setNewCardContent(e.target.value)}
              placeholder="Enter card capability..."
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              rows={3}
              required
            />
            <div className="flex items-center gap-2">
              <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors">
                Add card
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
