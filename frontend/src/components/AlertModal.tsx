import { Info } from "lucide-react";

interface AlertModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    buttonText?: string;
    onClose: () => void;
}

export default function AlertModal({ 
    isOpen, 
    title, 
    message, 
    buttonText = "OK", 
    onClose 
}: AlertModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4">
            <div className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-full flex-shrink-0">
                        <Info className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
                        <p className="text-sm text-slate-400 mb-6">{message}</p>
                        
                        <div className="flex justify-end">
                            <button 
                                onClick={onClose}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
                            >
                                {buttonText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
