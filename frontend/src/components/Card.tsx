import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lock, Pencil, Trash, X, Check, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { BoardActions, Card as CardType } from "../types";
import { useTranslation } from "react-i18next";
import ConfirmModal from "./ConfirmModal";
import { API_URL } from "../lib/api";

interface Props {
  card: CardType;
  currentSocketId: string | null;
  token: string;
  onUpdate: () => void;
  onOpenModal: (card: CardType) => void;
  actions: BoardActions;
}

export default function Card({ card, currentSocketId, token, onUpdate, onOpenModal, actions }: Props) {
  // Task/Card jest zablokowany jeśli ma ustalone lockedBy i to lockedBy nie jest naszym socketID
  const isLockedByOther = card.lockedBy !== null && card.lockedBy !== currentSocketId;
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(card.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { t } = useTranslation();

  const moveCardByOffset = actions.moveCardByOffset;

  const handleUpdate = async () => {
    if (!editedContent.trim() || editedContent === card.content) {
      setIsEditing(false);
      setEditedContent(card.content);
      return;
    }
    try {
      await fetch(`${API_URL}/api/cards/${card.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: editedContent })
      });
      setIsEditing(false);
      onUpdate();
    } catch {
      console.error("Failed to update card");
    }
  };

  const toggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_URL}/api/cards/${card.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isDone: !card.isDone })
      });
      onUpdate();
    } catch {
      console.error("Failed to toggle done");
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await fetch(`${API_URL}/api/cards/${card.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setShowDeleteConfirm(false);
      onUpdate();
    } catch {
      console.error("Failed to delete card");
    }
  };

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: "Card",
      card,
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
        className="bg-slate-700/50 outline outline-1 outline-[#3b82f6] rounded-md h-[120px] opacity-40"
      />
    );
  }

  const dateObj = card.createdAt ? new Date(card.createdAt) : new Date();
  const dateTag = `[${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')} - ${dateObj.toLocaleDateString("en-US", { weekday: "short" })}]`;

  const handleClick = () => !isLockedByOther && !isEditing && onOpenModal(card)

  return (
    <div
    ref={setNodeRef}
    style={style}
    {...attributes}
    {...(isLockedByOther || isEditing ? {} : listeners)}
    onClick={handleClick}
    onKeyDown={e => {if (e.key === "Enter") handleClick()}}
    aria-label={t("screenReaderEditCard")}
    tabIndex={0}
      className={`relative group flex flex-col p-4 rounded-lg shadow-sm border 
        ${isLockedByOther ? 'bg-[#1e1f24] border-slate-800 opacity-60 cursor-not-allowed' : card.isDone ? 'bg-[#15161a] border-[#22242b] opacity-80' : card.inProgress ? 'bg-[#291f13] border-[#a36214] opacity-90 cursor-grab' : 'bg-[#1e1f24] border-[#2a2d36] hover:border-[#3b82f6]/50 cursor-grab active:cursor-grabbing'}
        transition-all duration-200`}
    >
      {isEditing ? (
        <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
          <textarea
            autoFocus
            className="w-full px-2 py-1 text-sm bg-[#111113] border border-blue-500/50 rounded focus:outline-none resize-none text-slate-100 font-medium"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            rows={3}
          />
          <div className="flex items-center gap-2 justify-end">
            <button aria-label={t("screenReaderConfirmTitle")} onClick={handleUpdate} className="text-[#3bbaa8] p-1 bg-[#15161a] border border-[#2a2d36] rounded hover:border-[#3bbaa8] transition-colors">
              <Check size={14} />
            </button>
            <button aria-label={t("screenReaderCancelTitle")} onClick={() => { setIsEditing(false); setEditedContent(card.content); }} className="text-slate-400 p-1 bg-[#15161a] border border-[#2a2d36] rounded hover:text-rose-400 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Bar: Date Tag & Checkbox */}
          <div className="flex justify-between items-start w-full mb-3">
            <span className="text-[10px] font-bold text-slate-400 bg-[#252830] px-2 py-0.5 rounded-sm shadow-sm tracking-wide">
              {dateTag}
            </span>

            {isLockedByOther ? (
              <div className="flex items-center gap-1.5 text-rose-500 animate-pulse bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 shrink-0">
                <Lock size={10} />
                <span className="text-[9px] font-bold uppercase tracking-tight whitespace-nowrap">
                  {card.lockedByName || 'Inny'}
                </span>
              </div>
            ) : (
              <div onClick={toggleDone} className={`w-[18px] h-[18px] rounded flex items-center justify-center cursor-pointer transition-colors border ${card.isDone ? 'bg-[#3bbaa8] border-[#3bbaa8]' : 'bg-[#15161a] border-[#3a3e4a] hover:border-[#6082e6]'}`}>
                {card.isDone && <Check size={12} className="text-white" strokeWidth={3} />}
              </div>
            )}
          </div>

          {/* Title & Description */}
          <div className="flex gap-2 items-start mb-1.5">
            {card.priority === 'High' && <span title="High Priority"><ArrowUp size={16} className="text-rose-500 mt-0.5 shrink-0" /></span>}
            {card.priority === 'Medium' && <span title="Medium Priority"><Minus size={16} className="text-amber-500 mt-0.5 shrink-0" /></span>}
            {card.priority === 'Low' && <span title="Low Priority"><ArrowDown size={16} className="text-emerald-500 mt-0.5 shrink-0" /></span>}
            <h3 className={`font-bold text-[14px] leading-snug ${card.isDone ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
              {card.content}
            </h3>
          </div>
          {card.description && (
            <p className="text-[11px] text-slate-500 line-clamp-2 mb-3 leading-relaxed font-medium">
              {card.description}
            </p>
          )}

          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
              {card.tags.map((tag) => {
                const tagColor = "bg-[#1d3536] text-[#4fd1c5]"; // default cyan
                return (
                  <span key={tag.id} className={`text-[9px] ${tagColor} px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider`}>
                    {tag.name}
                  </span>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center mt-auto pt-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-700 border border-slate-600">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${card.id}`} alt="avatar" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isLockedByOther && !card.isDone && (
                <div className="opacity-60 group-hover:opacity-100 transition-opacity flex gap-1 mr-1" onClick={e => e.stopPropagation()}>
                  <button className="text-slate-300 text-[15px] sr-only focus:not-sr-only"
                    onClick={()=>moveCardByOffset(card,-1,0)}>
                    {t("screenReaderMoveCardLeft")}
                  </button>
                  <button className="text-slate-300 text-[15px] sr-only focus:not-sr-only"
                    onClick={()=>moveCardByOffset(card,1,0)}>
                    {t("screenReaderMoveCardRight")}
                  </button>
                  <button className="text-slate-300 text-[15px] sr-only focus:not-sr-only"
                    onClick={()=>moveCardByOffset(card,0,1)}>
                    {t("screenReaderMoveCardDown")}
                  </button>
                  <button className="text-slate-300 text-[15px] sr-only focus:not-sr-only"
                    onClick={()=>moveCardByOffset(card,0,-1)}>
                    {t("screenReaderMoveCardUp")}
                  </button>
                  <button aria-label={t("screenReaderEditCardTitle")} onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-blue-500 focus:text-blue-500 transition-colors p-1">
                    <Pencil size={12} />
                  </button>
                  <button aria-label={t("screenReaderDeleteCard")} onClick={handleDelete} className="text-slate-400 hover:text-rose-400 focus:text-rose-400 transition-colors p-1">
                    <Trash size={12} />
                  </button>
                </div>
              )}
              <span className="text-[9px] text-slate-400 font-medium">
                {card.completedAt ? t("cardCompleted", { date: new Date(card.completedAt).toLocaleDateString() }) : t("lastEdited", { count: "10" })} {/* TODO: hardcoded value */}
              </span>
            </div>
          </div>
        </>
      )}

      <ConfirmModal 
        isOpen={showDeleteConfirm}
        title={t("deleteBoardConfirm") || "Delete Card"}
        message={t("cardDeletionConfirmation")}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
