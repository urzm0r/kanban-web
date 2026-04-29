import { useState, useEffect } from "react";
import { X, UserMinus } from "lucide-react";
import { useTranslation } from "react-i18next";
import ConfirmModal from "./ConfirmModal";
import AlertModal from "./AlertModal";
import { API_URL } from "../lib/api";

interface ManageMembersModalProps {
    boardId: string;
    token: string;
    currentUserId: string;
    onClose: () => void;
    onMemberRemoved: () => void;
}

export default function ManageMembersModal({ boardId, token, currentUserId, onClose, onMemberRemoved }: ManageMembersModalProps) {
    const { t } = useTranslation();
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
    const [alertConfig, setAlertConfig] = useState<{title: string, message: string} | null>(null);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/boards/${boardId}/members`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setMembers(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = (userId: string) => {
        setConfirmRemoveId(userId);
    };

    const confirmMemberRemoval = async () => {
        if (!confirmRemoveId) return;
        try {
            const res = await fetch(`${API_URL}/api/boards/${boardId}/members/${confirmRemoveId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setMembers(members.filter(m => m.userId !== confirmRemoveId));
                onMemberRemoved();
                setConfirmRemoveId(null);
            } else {
                setAlertConfig({
                    title: "Error",
                    message: data.error || "Failed to remove member"
                });
            }
        } catch (err) {
            setAlertConfig({
                title: "Error",
                message: "An unexpected error occurred"
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <UserMinus className="w-5 h-5 text-orange-400" />
                        Manage Members
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <p className="text-center text-slate-500 py-4">{t("loading")}</p>
                    ) : members.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">{t("noMembersFound")}</p>
                    ) : (
                        members.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                <img 
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user.name}`} 
                                    alt={member.user.name} 
                                    className="w-8 h-8 rounded-full shrink-0" />
                                <div className="w-full pl-5">
                                    <p className="text-sm font-bold text-white">{member.user.name}</p>
                                    <p className="text-xs text-slate-500">{member.user.email}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mt-1 block">
                                        {member.role}
                                    </span>
                                </div>
                                {member.userId !== currentUserId && (
                                    <button 
                                        onClick={() => handleRemove(member.userId)}
                                        className="p-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <ConfirmModal 
                isOpen={!!confirmRemoveId}
                title={t("deleteBoardConfirm") || "Remove Member"}
                message={t("removeMemberMessage")}
                onConfirm={confirmMemberRemoval}
                onCancel={() => setConfirmRemoveId(null)}
            />

            <AlertModal 
                isOpen={!!alertConfig}
                title={alertConfig?.title || ""}
                message={alertConfig?.message || ""}
                onClose={() => setAlertConfig(null)}
            />
        </div>
    );
}
