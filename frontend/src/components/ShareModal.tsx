import { useState, useEffect } from "react";
import { X, Search, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import AlertModal from "./AlertModal";
import { API_URL } from "../lib/api";

interface User {
    id: string;
    name: string;
    email: string;
}

interface ShareModalProps {
    boardId: string;
    token: string;
    onClose: () => void;
}

export default function ShareModal({ boardId, token, onClose }: ShareModalProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    const searchUsers = async (query: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/users/search?q=${query}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setResults(data);
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search.length >= 2) {
                searchUsers(search);
            } else {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

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

                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="text"
                        autoFocus
                        placeholder={t("userSearchPlaceholder")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-[#111113] border border-white/5 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm text-slate-200"
                    />
                </div>

                <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                    {loading && <p className="text-center text-xs text-slate-500 py-4 font-bold uppercase tracking-widest animate-pulse">Searching...</p>}
                    {!loading && results.length === 0 && search.length >= 2 && (
                        <p className="text-center text-xs text-slate-500 py-4 font-bold uppercase tracking-widest">No users found</p>
                    )}
                    {results.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
                            <div>
                                <p className="text-sm font-bold text-white">{user.name}</p>
                                <p className="text-xs text-slate-500 font-medium">{user.email}</p>
                            </div>
                            <button 
                                onClick={() => handleInvite(user.id)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-blue-900/20"
                            >
                                {t("addNewCardConfirm")}
                            </button>
                        </div>
                    ))}
                </div>

                {message && (
                    <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs font-bold text-center animate-in slide-in-from-bottom-2 duration-300">
                        {message}
                    </div>
                )}
            </div>

            <AlertModal 
                isOpen={!!alertMessage}
                title="Info"
                message={alertMessage || ""}
                onClose={() => setAlertMessage(null)}
            />
        </div>
    );
}
