# Szczegółowa Dokumentacja Testów k6

Ten dokument opisuje, co dokładnie robi każdy z testów znajdujących się w folderze `k6/tests/` oraz jakie asercje (sprawdzenia) są w nich wykonywane.

---

## 1. `auth.test.js` (Autentykacja)
**Cel:** Sprawdzenie procesu rejestracji i logowania oraz obsługi błędów danych wejściowych.
- **Co robi:**
    - Rejestruje nowego, unikalnego użytkownika.
    - Loguje się na nowo utworzone konto.
    - Próbuje zarejestrować użytkownika na ten sam email (test duplikatu).
    - Próbuje zalogować się błędnym hasłem.
    - Testuje walidację (brakujące pola, zbyt krótkie hasło, niepoprawny format email).
- **Co sprawdza (Asercje):**
    - Czy status odpowiedzi to 200 (sukces) lub odpowiedni kod błędu (400, 401).
    - Czy serwer zwraca poprawny token JWT po rejestracji/logowaniu.
    - Czy dane użytkownika w odpowiedzi zgadzają się z przesłanymi.

## 2. `boards.test.js` (Zarządzanie Tablicami)
**Cel:** Testowanie pełnego cyklu życia tablicy oraz uprawnień i członków.
- **Co robi:**
    - Tworzy nową tablicę.
    - Pobiera listę wszystkich tablic użytkownika.
    - Pobiera szczegóły konkretnej tablicy.
    - Zmienia nazwę tablicy (`PUT /api/boards/:id`).
    - Dodaje i usuwa członka (innego użytkownika) z tablicy.
    - Sprawdza, czy osoba niebędąca członkiem ma zablokowany dostęp.
    - Usuwa tablicę (tylko właściciel).
- **Co sprawdza (Asercje):**
    - Czy tablica ma poprawne ID i właściciela.
    - Czy nowa nazwa została poprawnie zapisana.
    - Czy system uprawnień (403 Forbidden) działa dla osób postronnych.
    - Czy po usunięciu tablica rzeczywiście znika (404/500).

## 3. `lists.test.js` (Zarządzanie Listami)
**Cel:** Weryfikacja operacji na kolumnach (listach) wewnątrz tablicy.
- **Co robi:**
    - Tworzy nową listę (np. "To Do") przypisaną do tablicy.
    - Sprawdza, czy lista pojawia się w widoku szczegółów tablicy.
    - Zmienia nazwę listy.
    - Testuje walidację (np. próba utworzenia listy bez nazwy lub w nieistniejącej tablicy).
    - Usuwa listę.
- **Co sprawdza (Asercje):**
    - Czy lista posiada poprawne powiązanie z tablicą.
    - Czy zmiana nazwy jest natychmiastowa.
    - Czy kody statusu dla błędnych danych są poprawne (400, 404).

## 4. `cards.test.js` (Zarządzanie Kartami/Zadaniami)
**Cel:** Najbardziej rozbudowany test sprawdzający wszystkie aspekty pracy z zadaniami.
- **Co robi:**
    - Tworzy kartę z określonym priorytetem.
    - Edytuje treść i opis karty.
    - Przełącza statusy `isDone` (wykonane) oraz `inProgress` (w toku).
    - Przypisuje/odpisuje użytkownika od konkretnej karty (`PATCH /members`).
    - Wyszukuje kartę po tekście (`GET /cards/search`).
    - Przenosi kartę z jednej listy do drugiej.
    - Usuwa kartę.
- **Co sprawdza (Asercje):**
    - Czy priorytety i flagi (isDone) zmieniają się poprawnie.
    - Czy wyszukiwarka znajduje kartę po jej unikalnej treści.
    - Czy karta faktycznie zmienia `listId` po przeniesieniu.

## 5. `tags_users.test.js` (Tagi i Wyszukiwarka Użytkowników)
**Cel:** Sprawdzenie funkcji pomocniczych – etykiet oraz znajdowania znajomych.
- **Co robi:**
    - Tworzy nowe tagi z kolorami HEX.
    - Testuje "upsert" (tworzenie taga o tej samej nazwie nie powinno tworzyć duplikatu).
    - Pobiera listę wszystkich tagów.
    - Wyszukuje użytkowników po fragmencie nazwy lub emailu.
    - Sprawdza, czy wyszukiwarka nie zwraca "samego siebie".
- **Co sprawdza (Asercje):**
    - Czy format tagów jest poprawny (ID, nazwa, kolor).
    - Czy wyszukiwanie użytkowników zwraca tablicę obiektów.
    - Czy zapytania krótsze niż 2 znaki zwracają pustą listę (zgodnie z logiką backendu).

## 6. `e2e_scenario.test.js` (Scenariusz End-to-End)
**Cel:** Symulacja realnej ścieżki użytkownika (User Journey).
- **Co robi:**
    - Pełny proces: Rejestracja → Logowanie → Stworzenie Tablicy → Stworzenie 3 List (To Do, In Progress, Done) → Stworzenie 3 Kart → Przeniesienie karty → Oznaczenie karty jako ukończona → Dodanie taga → Zaproszenie innej osoby do tablicy → Sprzątanie (Usunięcie tablicy).
- **Co sprawdza (Asercje):**
    - Czy cały proces od A do Z przechodzi bez błędów.
    - Czy stany końcowe (liczba list, kart i członków) zgadzają się z oczekiwaniami po wykonaniu wszystkich kroków.
    - Mierzy łączny czas trwania całej sesji użytkownika (`e2e_scenario_duration`).
