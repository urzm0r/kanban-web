import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
    en: {
        translation: {
            // common
            loadingWorkspace: "Loading workspace...",
            dashboard: "Dashboard",
            language: "Language:",
            signIn: "Sign in",
            signIn_long: "Sign in to your account",
            signUp: "Sign up",
            signOut: "Sign out",
            userSettings: "User settings",
            saveAndClose: "Save and close",
            
            // auth screen
            email: "Email",
            password: "Password",
            createAccount: "Create a new account",
            signInProposal: "Already have an account?",
            signUpProposal: "Don't have an account?",
        
            // board view
            navbarSearch: "Search tasks, projects, or people...",
            addNewCard: "Add card",
            addNewCardConfirm: "Add",
            addNewCardCancel: "Cancel",
            addNewColumn: "Add new column",
            taskList: "Task List",
            analyticsList: "Analytics List",
            yearFilter: "Year: {{filter}}",
            taskProgressFilter: "Task progress: {{filter}}",
            statusFilter: "Status: {{filter}}",
            cardCompleted: "Completed: {{date}}",
            lastEdited: "Edited {{count}}m ago",
            sort: "Sort",
            moreFilters: "More filters",
            taskTitleHint: "Enter task title...",
            listDeletionConfirmation: "Do you really want to delete this list and all of its cards?",
            cardDeletionConfirmation: "Do you really want to delete this card?",
                 
            // card edit view
            cardCreated: "Created: {{date}}",
            cardContentTitle: "Task description",
            cardContentHint: "Add a description for this task...",
            markAsCompleted: "Mark as completed",
            markAsInProgress: "Mark as in progress",
            markAsToDo: "Mark as to-do",
            
            // analytics
            chartValue: "value: {{value}}",
            tagFrequency: "Tag frequency",
            tagsChartTitle: "Tags",
            noTags: "No tags",
            statusCompleted: "Done",
            statusInProgress: "In progress",
            statusToDo: "To do",
            lastWeek: "Last 7 days",
            cardVelocity: "Card velocity",
            statusBreakdown: "Status breakdown",
            workload_distribution: "Workload Distribution",
            card_aging: "Card Aging",
            locked_actionable: "Actionable vs Locked",
            priority_split: "Priority Split",
            effort_distribution: "Effort Distribution (Tags)",
        }
    },
    pl: {
        translation: {
            // common
            loadingWorkspace: "Ładowanie obszaru roboczego...",
            dashboard: "Panel główny",
            language: "Język:",
            signOut: "Wyloguj się",
            userSettings: "Ustawienia użytkownika",
            signIn: "Zaloguj się",
            signIn_long: "Zaloguj się na swoje konto",
            signUp: "Zarejestruj się",
            saveAndClose: "Zapisz i zamknij",
            
            // auth screen
            email: "Adres mejlowy",
            password: "Hasło",
            createAccount: "Stwórz nowe konto",
            signInProposal: "Masz już konto?",
            signUpProposal: "Nie masz konta?",
        
            // board view
            navbarSearch: "Szukaj zadań, projektów, osób...",
            addNewCard: "Dodaj kartę",
            addNewCardConfirm: "Dodaj",
            addNewCardCancel: "Anuluj",
            addNewColumn: "Dodaj nową listę",
            taskList: "Lista zadań",
            analyticsList: "Lista statystyk",
            yearFilter: "Rok: {{filter}}",
            taskProgressFilter: "Stan zadania: {{filter}}",
            statusFilter: "Status: {{filter}}",
            cardCompleted: "Ukończono: {{date}}",
            lastEdited: "Edytowano {{count}}min temu",
            sort: "Sortowanie",
            moreFilters: "Więcej filtrów",
            taskTitleHint: "Podaj nazwę zadania...",
            listDeletionConfirmation: "Czy na pewno chcesz usunąć tą listę i wszystkie jej karty?",
            cardDeletionConfirmation: "Czy na pewno chcesz usunąć tą kartę?",
                 
            // card edit view
            cardCreated: "Utworzono: {{date}}",
            cardContentTitle: "Szczegółowy opis",
            cardContentHint: "Wprowadź opis dla tego zadania...",
            markAsCompleted: "Oznacz jako ukończone",
            markAsInProgress: "Oznacz w toku",
            markAsToDo: "Oznacz jako do zrobienia",
            
            // analytics
            chartValue: "wartość: {{value}}",
            tagFrequency: "Rozkład znaczników",
            tagsChartTitle: "Znaczniki",
            noTags: "Bez znacznika",
            statusCompleted: "Ukończone",
            statusInProgress: "W trakcie",
            statusToDo: "Do zrobienia",
            lastWeek: "Ostatni tydzień",
            cardVelocity: "Aktywność",
            statusBreakdown: "Statusy kart",
            workload_distribution: "Obciążenie Kolumn",
            card_aging: "Wiek Zadań",
            locked_actionable: "Dostępne vs Zablokowane",
            priority_split: "Podział Priorytetów",
            effort_distribution: "Rozkład Wysiłku (Tagi)",
        }
    }
}

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: "en",
        
        interpolation: {
            escapeValue: false
        }
    })