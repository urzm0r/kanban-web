import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Plus, Search, LayoutGrid, Users, Settings, UserPlus, UserMinus, Trash2, Pencil } from "lucide-react";
import ShareModal from "./ShareModal";
import ManageMembersModal from "./ManageMembersModal";
import ConfirmModal from "./ConfirmModal";
import AlertModal from "./AlertModal";
import UserSettings from "./UserSettings";
import { parseJwt } from "../lib/jwt";
import { API_URL } from "../lib/api";

interface BoardInfo {
    id: string;
    title: string;
    ownerId: string;
    _count: { members: number };
}

export default function Dashboard({ token, userId, onLogout }: { token: string, userId: string, onLogout: () => void }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [boards, setBoards] = useState<BoardInfo[]>([]);
    const [userResults, setUserResults] = useState<{ id: string, name: string, email: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [newBoardTitle, setNewBoardTitle] = useState("");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [shareBoardId, setShareBoardId] = useState<string | null>(null);
    const [manageMembersBoardId, setManageMembersBoardId] = useState<string | null>(null);
    const [renameBoardId, setRenameBoardId] = useState<string | null>(null);
    const [renameBoardTitle, setRenameBoardTitle] = useState("");

    // Modal states
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [alertConfig, setAlertConfig] = useState<{ title: string, message: string } | null>(null);

    const currentUser = parseJwt(token);


    useEffect(() => {
        fetchBoards();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search.length >= 2) {
                searchUsers();
            } else {
                setUserResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchBoards = async () => {
        try {
            const res = await fetch(`${API_URL}/api/boards`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setBoards(data);
        } catch (err) {
            console.error("Error fetching boards", err);
        } finally {
            setLoading(false);
        }
    };

    const searchUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/users/search?q=${search}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setUserResults(data);
        } catch (err) {
            console.error("User search error", err);
        }
    };

    const handleCreateBoard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBoardTitle.trim()) return;

        try {
            const res = await fetch(`${API_URL}/api/boards`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ title: newBoardTitle })
            });
            const data = await res.json();
            if (res.ok) {
                // Redirect immediately to the newly created board
                navigate(`/board/${data.id}`);
            }
        } catch (err) {
            console.error("Error creating board", err);
        }
    };

    const handleRenameBoard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renameBoardId || !renameBoardTitle.trim()) return;

        try {
            const res = await fetch(`${API_URL}/api/boards/${renameBoardId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ title: renameBoardTitle })
            });
            if (res.ok) {
                setBoards(boards.map(b => b.id === renameBoardId ? { ...b, title: renameBoardTitle } : b));
                setRenameBoardId(null);
            }
        } catch (err) {
            console.error("Error renaming board", err);
        }
    };

    const handleDeleteBoard = (boardId: string) => {
        setConfirmDeleteId(boardId);
    };

    const confirmBoardDeletion = async () => {
        if (!confirmDeleteId) return;
        try {
            const res = await fetch(`${API_URL}/api/boards/${confirmDeleteId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setBoards(boards.filter(b => b.id !== confirmDeleteId));
                setConfirmDeleteId(null);
            } else {
                setAlertConfig({
                    title: "Error",
                    message: data.error || "Failed to delete board"
                });
            }
        } catch {
            setAlertConfig({
                title: "Error",
                message: "An unexpected error occurred"
            });
        }
    };

    const handleRemoveUser = (boardId: string) => {
        setManageMembersBoardId(boardId);
    };

    const filteredBoards = boards.filter(b =>
        b.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-screen w-full bg-[#111113] text-slate-100 font-sans overflow-y-auto">
            {/* Top Navbar */}
            <nav className="h-14 border-b border-white/5 bg-[#17171a] flex items-center justify-between px-8 shrink-0 z-10 w-full sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-600/20 rounded-lg border border-blue-500/30">
                        <LayoutGrid className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Kanban Workspace
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 pr-4 border-r border-white/10">
                        <span className="text-sm font-semibold text-slate-300">
                            {currentUser?.name || "User"}
                        </span>
                        <UserSettings board={{ title: currentUser?.name || "User" }} user={currentUser} />
                    </div>

                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e24] border border-white/5 hover:bg-white/5 rounded-md text-sm text-slate-400 hover:text-slate-200 transition-all font-medium cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                        {t("signOut")}
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto w-full px-8 py-10">
                <header className="mb-10">
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                        Your Boards
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Manage your projects and collaborate with your team.
                    </p>
                </header>

                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder={t("navbarSearch")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[#17171a] border border-white/5 rounded-lg focus:outline-none focus:border-blue-500/50 transition-all text-sm text-slate-300"
                        />
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-900/20 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        {t("createBoard")}
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-pulse text-slate-500 font-medium tracking-widest">{t("loadingWorkspace")}</div>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Boards Section */}
                        <section>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredBoards.map(board => (
                                    <div
                                        key={board.id}
                                        tabIndex={0}
                                        onKeyDown={e => { if (e.key === "Enter") navigate(`/board/${board.id}`) }}
                                        className="group relative bg-[#17171a] border border-white/5 rounded-xl hover:border-blue-500/50 transition-all hover:bg-[#1e1e24] shadow-sm flex flex-col justify-between h-40"
                                    >
                                        <div
                                            className="p-5 pb-0 cursor-pointer flex-1"
                                            onClick={() => navigate(`/board/${board.id}`)}
                                        >
                                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-1 flex items-center gap-2 min-w-0">
                                                <span className="truncate">{board.title}</span>
                                            </h3>
                                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                                Board
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-white/5 p-4 mt-2">
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <Users className="w-3.5 h-3.5" />
                                                <span className="text-xs font-semibold">{board._count.members} {t("members")}</span>
                                            </div>

                                            <div className="relative flex items-center justify-end">
                                                {/* Expanded Menu */}
                                                <div
                                                    className={`flex items-center gap-1.5 overflow-hidden transition-all duration-300 ease-in-out ${openMenuId === board.id ? 'max-w-[160px] opacity-100 mr-2' : 'max-w-0 opacity-0'}`}
                                                >
                                                    {board.ownerId === userId && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setShareBoardId(board.id); setOpenMenuId(null); }}
                                                                className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                                title={t("addUserTooltip")}
                                                            >
                                                                <UserPlus className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveUser(board.id); setOpenMenuId(null); }}
                                                                className="p-1.5 bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                                title={t("removeUserTooltip")}
                                                            >
                                                                <UserMinus className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setRenameBoardId(board.id); setRenameBoardTitle(board.title); setOpenMenuId(null); }}
                                                                className="p-1.5 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                                title={t("renameBoardTitleModal")}
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board.id); setOpenMenuId(null); }}
                                                                className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                                title={t("deleteBoardTooltip")}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Gear Button */}
                                                {board.ownerId === userId && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === board.id ? null : board.id);
                                                        }}
                                                        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 z-10 bg-[#17171a] cursor-pointer
                                                            ${openMenuId === board.id
                                                                ? 'border-blue-500 bg-blue-500/10 text-blue-400 rotate-90'
                                                                : 'border-white/10 text-slate-400 group-hover:border-blue-500/50 group-hover:text-blue-400 hover:bg-blue-500/10'
                                                            }`}
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Users Section (Only visible during search) */}
                        {userResults.length > 0 && (
                            <section className="animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-2 mb-6 border-l-2 border-blue-500 pl-4">
                                    <h2 className="text-xl font-bold text-white">{t("people")}</h2>
                                    <span className="text-xs font-bold bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full">
                                        {userResults.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {userResults.map(user => (
                                        <div
                                            key={user.id}
                                            className="flex items-center gap-4 p-4 bg-[#17171a] border border-white/5 rounded-xl hover:bg-[#1e1e24] transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-bold text-white truncate">{user.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </main>

            {renameBoardId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e1e24] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold mb-6 text-white">{t("renameBoardTitleModal")}</h2>
                        <form onSubmit={handleRenameBoard}>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{t("boardTitleLabel")}</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    maxLength={50}
                                    value={renameBoardTitle}
                                    onChange={(e) => setRenameBoardTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-[#111113] border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 transition-all text-slate-200"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRenameBoardId(null)}
                                    className="flex-1 px-4 py-2.5 bg-transparent hover:bg-white/5 border border-white/10 text-slate-400 font-bold rounded-lg transition-all text-sm"
                                >
                                    {t("addNewCardCancel")}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm shadow-lg shadow-blue-900/20 cursor-pointer"
                                >
                                    {t("change")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e1e24] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold mb-6 text-white">{t("createBoard")}</h2>
                        <form onSubmit={handleCreateBoard}>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{t("boardTitleLabel")}</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    maxLength={50}
                                    value={newBoardTitle}
                                    onChange={(e) => setNewBoardTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-[#111113] border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 transition-all text-slate-200"
                                    placeholder={t("boardTitlePlaceholder")}
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-transparent hover:bg-white/5 border border-white/10 text-slate-400 font-bold rounded-lg transition-all text-sm"
                                >
                                    {t("addNewCardCancel")}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm shadow-lg shadow-blue-900/20"
                                >
                                    {t("addNewCardConfirm")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {shareBoardId && (
                <ShareModal
                    boardId={shareBoardId}
                    token={token}
                    onClose={() => setShareBoardId(null)}
                />
            )}
            {manageMembersBoardId && (
                <ManageMembersModal
                    boardId={manageMembersBoardId}
                    token={token}
                    currentUserId={userId}
                    onClose={() => setManageMembersBoardId(null)}
                    onMemberRemoved={fetchBoards}
                />
            )}

            <ConfirmModal
                isOpen={!!confirmDeleteId}
                title={t("deleteBoardConfirm") || "Delete Board"}
                message={t("deleteBoardMessage")}
                onConfirm={confirmBoardDeletion}
                onCancel={() => setConfirmDeleteId(null)}
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
