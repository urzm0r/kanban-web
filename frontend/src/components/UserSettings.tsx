import { useEffect, useState, useRef } from "react"
import { useTranslation } from "react-i18next";

export default function UserSettings({ board }: { board: any }) {
    const { t, i18n } = useTranslation();
    const [settingsVisible, setSettingsVisible] = useState(false)
    const componentRef = useRef<HTMLDivElement>(null);
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language || "en")

    useEffect(() => {
        function hideSettings(event: MouseEvent) {
            if (componentRef.current && !componentRef.current.contains(event.target as Node)) {
                setSettingsVisible(false)
            }
        }

        document.addEventListener("click", hideSettings)

        return () => {
            document.removeEventListener("click", hideSettings)
        }
    }, [])

    const handleSelectLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value;
        setCurrentLanguage(newLang);
        i18n.changeLanguage(newLang);
    }

    return (
        <div ref={componentRef} className="relative">
            {/* user icon */}
            <button aria-label={t("screenReaderOpenUserSettings")}
             onClick={() => setSettingsVisible(!settingsVisible)} 
             className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm overflow-hidden border border-slate-600 shadow-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            >
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${board?.title || "user"}`} alt="avatar" />
            </button>

            {/* settings menu */}
            {settingsVisible && 
            <section className="absolute top-12 right-0 p-4 bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl z-[300] min-w-[180px]">
                <h2 className="font-bold text-sm text-white mb-3 border-b border-white/5 pb-2 uppercase tracking-widest">{t("userSettings")}</h2>
                <div className="flex flex-col gap-1">
                    <label htmlFor="user-language" className="text-xs font-semibold text-slate-500 mb-1">
                        {t("language")}
                    </label>
                    <select 
                        id="user-language" 
                        onChange={handleSelectLanguage} 
                        value={currentLanguage}
                        className="w-full bg-[#111113] border border-white/10 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-300 focus:outline-none focus:border-blue-500 transition-all shadow-md"
                    >
                        <option value="en">🇺🇸 English</option>
                        <option value="pl">🇵🇱 Polski</option>
                    </select>
                </div>
            </section>}
        </div>
    )
}