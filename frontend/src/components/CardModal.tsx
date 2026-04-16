import { useState, useEffect } from "react";
import { X, CheckCircle } from "lucide-react";
import type { Card as CardType } from "../types";

import { withTranslation } from "react-i18next";

interface Props {
  t: any,
  i18n: any,
  card: CardType;
  token: string;
  onClose: () => void;
  onUpdate: () => void;
  socket: any;
}

function CardModal({ t, i18n, card, token, onClose, onUpdate, socket }: Props) {
  const [description, setDescription] = useState(card.description || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Lock the card for editing for safety
    if (!card.lockedBy) socket.emit("card:locked", card.id);
    return () => {
      socket.emit("card:unlocked", card.id);
    };
  }, [card.id, card.lockedBy, socket]);

  const handleSave = async (markAsDone?: boolean) => {
    setIsSaving(true);
    const updates: any = { description };
    if (markAsDone !== undefined) {
        updates.isDone = markAsDone;
    }
    try {
      await fetch(`http://localhost:3001/api/cards/${card.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      onUpdate();
      if (markAsDone !== undefined) onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
        handleSave();
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 cursor-auto" onClick={handleOverlayClick}>
      <div className="bg-[#1e293b] rounded-xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="p-6 border-b border-slate-700 flex justify-between items-start gap-4">
            <div>
                <h2 className="text-xl font-bold text-slate-100">{card.content}</h2>
                <div className="flex gap-4 text-xs text-slate-400 mt-2 font-medium">
                    <span>{t("cardCreated", {date: new Date(card.createdAt).toLocaleDateString()})}</span>
                    {card.completedAt && <span className="text-emerald-400">{t("cardCompleted", {date: new Date(card.completedAt).toLocaleDateString()})}</span>}
                </div>
            </div>
            <button onClick={() => { handleSave(); onClose(); }} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg shrink-0">
                <X size={20} />
            </button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">{t("cardContentTitle")}</label>
                <textarea
                    autoFocus
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Dodaj więcej szczegółowych informacji do tego zadania..."
                    className="w-full min-h-[150px] p-4 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                />
            </div>
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/30 flex justify-end gap-3">
            <button 
                onClick={() => { handleSave(); onClose(); }} 
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
            >
                {t("saveAndClose")}
            </button>
            
            <button 
                onClick={() => handleSave(!card.isDone)}
                disabled={isSaving} 
                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all shadow-lg
                    ${card.isDone 
                        ? 'bg-slate-700 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-600 hover:border-rose-500' 
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 border border-emerald-500'}`}
            >
                <CheckCircle size={18} />
                {card.isDone ? t("markAsToDo") : t("markAsCompleted")}
            </button>
        </div>

      </div>
    </div>
  );
}

export default withTranslation()(CardModal)