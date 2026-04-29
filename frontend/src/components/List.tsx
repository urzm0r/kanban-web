import { useState } from "react";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CardComp from "./Card";
import type { ListType, Card, BoardActions } from "../types";
import { Plus, Pencil, Trash, X, Check } from "lucide-react";
import TelemetryColumn from "./TelemetryColumn";
import { useTranslation } from "react-i18next";
import ConfirmModal from "./ConfirmModal";
import { API_URL } from "../lib/api";

interface Props {
  list: ListType;
  cards: Card[];
  currentSocketId: string | null;
  token: string;
  onAddCard: () => void;
  onOpenModal?: (card: Card) => void;
  boardCards?: Card[];
  allLists?: ListType[];
  actions: BoardActions;
  confettiEnabled?: boolean;
}

const LIST_COLORS = [
  "#6082e6", // blue
  "#3bdaa8", // green
  "#d4b331", // yellow
  "#ba3b3b", // red
  "#9f3acd", // purple
  "#cdcdcd", // white
];

export default function List({ list, cards, currentSocketId, token, onAddCard, onOpenModal, boardCards, allLists, actions, confettiEnabled }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCardContent, setNewCardContent] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const { t } = useTranslation();

  const { moveListByOffset } = actions;

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
      await fetch(`${API_URL}/api/cards`, {
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
      await fetch(`${API_URL}/api/lists/${list.id}`, {
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

  const handleDeleteList = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await fetch(`${API_URL}/api/lists/${list.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setShowDeleteConfirm(false);
      onAddCard();
    } catch (e) {
      console.error("Failed to delete list", e);
    }
  };

  const handleChangeColor = async () => {
    const nextColor = (list.color + 1) % LIST_COLORS.length;

    try {
      await fetch(`${API_URL}/api/lists/${list.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ color: nextColor })
      });
    } catch (e) {
      console.error("Failed to change color", e);
    }
  }

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
              maxLength={40}
              className="flex-grow px-2 py-1 text-sm font-bold bg-[#111113] text-slate-100 border border-blue-500 rounded focus:outline-none"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
            />
            <button aria-label={t("screenReaderConfirmTitle")} onClick={handleUpdateTitle} className="text-[#3bbaa8] hover:text-[#4fd1c5] focus:text-[#4fd1c5] cursor-pointer">
              <Check size={16} />
            </button>
            <button aria-label={t("screenReaderCancelTitle")} onClick={() => { setIsEditingTitle(false); setEditedTitle(list.title); }} className="text-slate-400 hover:text-slate-200 focus:text-slate-200 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-grow">
            <div className="flex items-center gap-2">
              {/* color switcher */}
              <button
                aria-label="change list color"
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer -ml-1.5"
                onClick={() => handleChangeColor()}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ backgroundColor: LIST_COLORS[list.color] }}
                />
              </button>
              <h2 className="font-semibold text-[16px] text-slate-200 break-words whitespace-pre-wrap">{list.title}</h2>
              <span className="bg-[#24272c] text-xs font-bold px-2 py-0.5 rounded flex items-center justify-center text-slate-400">
                {cards.length}
              </span>
            </div>
            <div className="opacity-60 group-hover:opacity-100 transition-opacity flex items-center gap-2">
              <button aria-label={t("screenReaderEditListTitle")} onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }} className="text-slate-400 hover:text-blue-500 focus:text-blue-500 transition-colors cursor-pointer">
                <Pencil size={16} />
              </button>
              <button aria-label={t("screenReaderDeleteList")} onClick={handleDeleteList} className="text-slate-400 hover:text-rose-400 focus:text-rose-400 transition-colors cursor-pointer">
                <Trash size={16} />
              </button>
              <button className="text-slate-300 text-[15px] sr-only focus:not-sr-only" onClick={() => moveListByOffset(list.id, -1)}>
                {t("screenReaderMoveListLeft")}
              </button>
              <button className="text-slate-300 text-[15px] sr-only focus:not-sr-only" onClick={() => moveListByOffset(list.id, 1)}>
                {t("screenReaderMoveListRight")}
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
                <CardComp key={card.id} card={card} currentSocketId={currentSocketId} token={token} onUpdate={onAddCard} onOpenModal={onOpenModal!} actions={actions} confettiEnabled={confettiEnabled} />
              ))}
            </SortableContext>
          </div>

          {/* Footer */}
          <div className="px-3 pb-3 pt-1 shrink-0">
            {!isAdding ? (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center justify-center gap-2 w-full p-2 rounded-md text-[15px] font-semibold text-slate-500 hover:bg-[#202127] hover:text-[#7896ee] transition-all"
              >
                <Plus size={16} /> {t("addNewCard")}
              </button>
            ) : (
              <form onSubmit={handleAddCard} className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  maxLength={100}
                  value={newCardContent}
                  onChange={e => setNewCardContent(e.target.value)}
                  placeholder={t("taskTitleHint")}
                  className="w-full px-3 py-2 text-sm bg-[#111113] border border-white/10 rounded focus:outline-none focus:border-blue-500/50 text-slate-200 resize-none font-medium"
                  rows={3}
                  required
                />
                <div className="flex items-center gap-2">
                  <button type="submit" className="px-3 py-1.5 text-xs bg-[#7896ee]/10 hover:bg-[#7896ee]/20 text-[#7896ee] font-semibold border border-[#7896ee]/20 rounded transition-colors w-full cursor-pointer">
                    {t("add")}
                  </button>
                  <button type="button" onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-[#1e2025] hover:bg-[#25282d] border border-white/5 rounded transition-colors w-full">
                    {t("addNewCardCancel")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={t("deleteListConfirm") || "Delete List"}
        message={t("listDeletionConfirmation")}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={t("confirm")}
        cancelText={t("cancel")}
      />
    </div>
  );
}