import { useState, useEffect, useRef } from "react";
import { X, CheckCircle, Activity, Tag as TagIcon, BarChart2 } from "lucide-react";
import type { Card as CardType, TagType } from "../types";
import { useTranslation } from "react-i18next";
import { API_URL } from "../lib/api";

interface Props {
  card: CardType;
  token: string;
  onClose: () => void;
  onUpdate: () => void;
  socket: any;
  boardId: string;
}

export default function CardModal({ card, token, onClose, onUpdate, socket, boardId }: Props) {
  const [description, setDescription] = useState(card.description || "");
  const [priority, setPriority] = useState(card.priority || "Medium");
  const [tags, setTags] = useState<TagType[]>(card.tags || []);
  
  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const tagDropRef = useRef<HTMLDivElement>(null);
  const cardDescriptionRef = useRef<HTMLTextAreaElement>(null)

  const { t } = useTranslation();

  useEffect(() => {
    // Lock the card for editing for safety
    if (!card.lockedBy) socket?.emit("card:locked", { cardId: card.id, boardId });
    return () => {
      socket?.emit("card:unlocked", { cardId: card.id, boardId });
    };
  }, [card.id, card.lockedBy, socket, boardId]);

  useEffect(() => {
    fetch(`${API_URL}/api/tags`, {
        headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => setAvailableTags(data || [])).catch(console.error);
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropRef.current && !tagDropRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    cardDescriptionRef.current?.focus()
  }, [])

  const handleAddTag = async (tagName: string) => {
      const name = tagName.trim();
      if (!name) return;
      
      const existing = availableTags.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (existing) {
          if (!tags.find(t => t.id === existing.id)) setTags([...tags, existing]);
          setTagInput("");
          setShowTagDropdown(false);
          return;
      }
      
      // Create new tag
      try {
          const res = await fetch(`${API_URL}/api/tags`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ name })
          });
          const newTag = await res.json();
          setAvailableTags([...availableTags, newTag]);
          setTags([...tags, newTag]);
          setTagInput("");
          setShowTagDropdown(false);
      } catch(e) { console.error(e) }
  };

  const handleRemoveTag = (tagId: string) => {
      setTags(tags.filter(t => t.id !== tagId));
  };

  const handleSave = async (markAsDone?: boolean) => {
    setIsSaving(true);
    const updates: any = { 
        description,
        priority,
        tags: tags.map(t => t.id)
    };
    if (markAsDone !== undefined) {
        updates.isDone = markAsDone;
        updates.inProgress = false;
    }
    try {
      await fetch(`${API_URL}/api/cards/${card.id}`, {
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

  const handleOverlayClick = async (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
        await handleSave();
        onClose();
    }
  };

  const handleSetInProgress = async () => {
    setIsSaving(true);
    const updates: any = { isDone: false, inProgress: true };
    try {
      await fetch(`${API_URL}/api/cards/${card.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      onUpdate();
      onClose();
    } catch (e) {
      console.error(e);
      setIsSaving(false);
    }
  };

  const filteredTags = availableTags.filter(t => t.name.toLowerCase().includes(tagInput.toLowerCase()) && !tags.find(sel => sel.id === t.id));

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
            <button aria-label={t("saveAndClose")} onClick={async () => { await handleSave(); onClose(); }} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg shrink-0">
                <X size={20} />
            </button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto flex flex-col gap-6">
            
            <div className="flex flex-wrap gap-6">
                {/* Priority Selection */}
                <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                    <label className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><BarChart2 size={16}/> Priority</label>
                    <div className="flex gap-2">
                        {['Low', 'Medium', 'High'].map(p => (
                            <button
                                key={p}
                                aria-label={t("screenReaderSetCardPriority", {priority: p})}
                                onClick={() => setPriority(p)}
                                className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all border ${
                                    priority === p 
                                    ? (p === 'High' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : p === 'Medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50')
                                    : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700'
                                }`}
                            >{p}</button>
                        ))}
                    </div>
                </div>

                {/* Tags Management */}
                <div className="flex flex-col gap-2 flex-1 min-w-[200px]" ref={tagDropRef}>
                    <label className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><TagIcon size={16}/> Tags</label>
                    
                    <div className="flex flex-wrap gap-2 mb-1">
                        {tags.map(t => (
                            <span key={t.id} className="bg-[#1c2c4d] text-[#6082e6] border border-[#2e4073] px-2 py-1 flex items-center gap-1 rounded text-xs font-bold">
                                {t.name}
                                <button onClick={() => handleRemoveTag(t.id)} className="hover:text-rose-400 ml-1"><X size={12}/></button>
                            </span>
                        ))}
                    </div>

                    <div className="relative">
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => { setTagInput(e.target.value); setShowTagDropdown(true); }}
                            onFocus={() => setShowTagDropdown(true)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddTag(tagInput);
                                }
                            }}
                            placeholder="Type to search or create tag..."
                            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                        />
                        {showTagDropdown && tagInput.trim() && (
                            <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20">
                                {filteredTags.map(t => (
                                    <div key={t.id} onClick={() => handleAddTag(t.name)} className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 cursor-pointer">
                                        {t.name}
                                    </div>
                                ))}
                                {!filteredTags.length && (
                                    <div onClick={() => handleAddTag(tagInput)} className="px-3 py-2 text-sm text-blue-400 hover:bg-slate-700 cursor-pointer font-medium">
                                        Create tag "{tagInput}" +
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2 line-horizontal mt-2">
                <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">{t("cardContentTitle")}</label>
                <textarea
                    ref={cardDescriptionRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Dodaj więcej szczegółowych informacji do tego zadania..."
                    className="w-full min-h-[150px] p-4 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                />
            </div>
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/30 flex justify-end gap-3">
            <button 
                onClick={async () => { await handleSave(); onClose(); }} 
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
            >
                {t("saveAndClose")}
            </button>
            
            {!card.isDone && !card.inProgress && (
              <button 
                  onClick={handleSetInProgress}
                  disabled={isSaving} 
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all shadow-lg bg-amber-500 hover:bg-amber-400 text-white shadow-amber-900/20 border border-amber-500"
              >
                  <Activity size={18} />
                  {t("markAsInProgress")}
              </button>
            )}

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