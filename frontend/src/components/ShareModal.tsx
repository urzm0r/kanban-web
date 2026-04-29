import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import AlertModal from "./AlertModal";
import { API_URL } from "../lib/api";
import UserSearch from "./UserSearch";

interface ShareModalProps {
    boardId: string;
    token: string;
    onClose: () => void;
}

export default function ShareModal({ boardId, token, onClose }: ShareModalProps) {
    const { t } = useTranslation();

    const [message, setMessage] = useState("");
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    const handleInvite = async (userId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/boards/${boardId}/members`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ userId, role: "MEMBER" })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(t("userInvited") || "User invited successfully!");
                setTimeout(() => setMessage(""), 3000);
            } else {
                setAlertMessage(data.error || "Failed to invite user");
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <UserPlus className="w-5 h-5 text-blue-400" />
                        {t("inviteUser")}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <UserSearch
                    boardId={boardId}
                    token={token}
                    onAddUser={handleInvite}
                    omitSelf={true}
                />

                {message && (
                    <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs font-bold text-center animate-in slide-in-from-bottom-2 duration-300">
                        {message}
                    </div>
                )}
            </div>

            <AlertModal 
                isOpen={!!alertMessage}
                title={t("info")}
                message={alertMessage || ""}
                onClose={() => setAlertMessage(null)}
            />
        </div>
    );
}
