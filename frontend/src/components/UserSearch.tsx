import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { API_URL } from "../lib/api";


interface User {
    id: string;
    name: string;
    email: string;
};

interface UserSearchProps {
    boardId: string;
    token: string;
    onAddUser: (userId: string) => void;
    omitSelf?: boolean;
    currentBoardOnly?: boolean;
};

export default function UserSearch({ boardId, token, onAddUser, omitSelf = false, currentBoardOnly = false }: UserSearchProps) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    const { t } = useTranslation();


    const searchUsers = async (query: string) => {
        setLoading(true);
        try {
            let request = `${API_URL}/api/users/search?q=${query}&omitSelf=${omitSelf.toString()}`;
            if (currentBoardOnly) request += `&board=${boardId}`;

            const res = await fetch(request, {
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


    return <>
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
            {loading && <p className="text-center text-xs text-slate-500 py-4 font-bold uppercase tracking-widest animate-pulse">{t("searching")}</p>}
            {!loading && results.length === 0 && search.length >= 2 && (
                <p className="text-center text-xs text-slate-500 py-4 font-bold uppercase tracking-widest">{t("noUsersFound")}</p>
            )}
            {results.map(user => (
                <div tabIndex={0} key={user.id} className="flex items-center p-3 hover:bg-white/5 rounded-xl transition-colors group"
                    onKeyDown={e => { if (e.key === "Enter") onAddUser(user.id) }}>
                    <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`}
                        alt={user.name}
                        className="w-8 h-8 rounded-full shrink-0" />
                    <div className="w-full pl-5">
                        <p className="text-sm font-bold text-white">{user.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{user.email}</p>
                    </div>
                    <button
                        onClick={() => onAddUser(user.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-blue-900/20 cursor-pointer"
                    >
                        {t("invite")}
                    </button>
                </div>
            ))}
        </div>
    </>;
}