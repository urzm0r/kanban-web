import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({ 
    isOpen, 
    title, 
    message, 
    confirmText = "Confirm", 
    cancelText = "Cancel", 
    onConfirm, 
    onCancel 
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-500/10 rounded-full flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
                        <p className="text-sm text-slate-400 mb-6">{message}</p>
                        
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={onCancel}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                            >
                                {cancelText}
                            </button>
                            <button 
                                onClick={onConfirm}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-red-900/20"
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
