import { useState } from "react";
import { X, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import AlertModal from "./AlertModal";
import { API_URL } from "../lib/api";
import type { User as UserType } from "../types";
import UserSearch from "./UserSearch";

interface CardMembersModalProps {
    boardId: string;
    token: string;
    cardId: string;
    members: UserType[];
    onClose: () => void;
}

export default function CardMembersModal({ boardId, token, cardId, members, onClose }: CardMembersModalProps) {
    useTranslation();

    // Modal states
    const [alertConfig, setAlertConfig] = useState<{title: string, message: string} | null>(null);

    const handleAddUser = async (userId: string) => {
        // Assign user to card
        try {
            await fetch(`${API_URL}/api/cards/${cardId}/members/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ isMember: true }),
            })
        } catch(e) { console.error(e) }
    }


    const handleRemove = async (userId: string) => {
        // Remove user from card
        try {
            await fetch(`${API_URL}/api/cards/${cardId}/members/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ isMember: false }),
            })
        } catch(e) { console.error(e) }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <User className="w-5 h-5 text-white" />
                        Assign members
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar mb-4">
                    {members.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">{t("noMembersFound")}</p>
                    ) : (
                        members.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                <img 
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.name)}`} 
                                    alt={member.name} 
                                    className="w-8 h-8 rounded-full shrink-0" />
                                <div className="w-full pl-5">
                                    <p className="text-sm font-bold text-white">{member.name}</p>
                                    <p className="text-xs text-slate-500">{member.email}</p>
                                </div>
                                <button 
                                    onClick={() => handleRemove(member.id)}
                                    className="p-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <UserSearch
                    boardId={boardId}
                    token={token}
                    onAddUser={handleAddUser}
                    currentBoardOnly={true}
                />
            </div>

            <AlertModal 
                isOpen={!!alertConfig}
                title={alertConfig?.title || ""}
                message={alertConfig?.message || ""}
                onClose={() => setAlertConfig(null)}
            />
        </div>
    );
}
