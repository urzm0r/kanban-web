# k6 Load Tests — Kanban Web Application

Zestaw testów wydajnościowych i funkcjonalnych napisanych w [k6](https://k6.io/) dla backendu aplikacji Kanban.

## Struktura

```
k6/
├── config.js                     # Konfiguracja: BASE_URL, thresholds, profile stages
├── helpers.js                    # Helpery: rejestracja, login, CRUD wrappery
├── tests/
│   ├── auth.test.js              # Testy autentykacji (register, login, walidacja)
│   ├── boards.test.js            # Testy zarządzania boardami + członkami
│   ├── lists.test.js             # Testy CRUD list
│   ├── cards.test.js             # Testy CRUD kart (pola, przenoszenie, walidacja)
│   ├── tags_users.test.js        # Testy tagów i wyszukiwania użytkowników
│   └── e2e_scenario.test.js      # Pełny scenariusz end-to-end
└── README.md
```

## Wymagania

1. **k6** — zainstaluj z https://k6.io/docs/get-started/installation/
   ```bash
   # Windows (winget)
   winget install k6

   # Windows (choco)
   choco install k6

   # macOS
   brew install k6
   ```

2. **Backend** — serwer musi działać (domyślnie `http://localhost:3001`)

## Uruchamianie testów

### Pojedynczy test (profil smoke — 1 VU, 30s)
```bash
k6 run k6/tests/auth.test.js
```

### Zmiana profilu obciążenia
```bash
# Load test (10 VU)
k6 run -e TEST_PROFILE=load k6/tests/boards.test.js

# Stress test (do 100 VU)
k6 run -e TEST_PROFILE=stress k6/tests/cards.test.js

# Spike test (nagły skok do 100 VU)
k6 run -e TEST_PROFILE=spike k6/tests/e2e_scenario.test.js
```

### Zmiana adresu backendu
```bash
k6 run -e BASE_URL=http://192.168.1.100:3001 k6/tests/auth.test.js
```

### Uruchomienie wszystkich testów
```bash
k6 run k6/tests/auth.test.js
k6 run k6/tests/boards.test.js
k6 run k6/tests/lists.test.js
k6 run k6/tests/cards.test.js
k6 run k6/tests/tags_users.test.js
k6 run k6/tests/e2e_scenario.test.js
```

## Profile obciążenia

| Profil    | Opis                                           | Max VU |
|-----------|-------------------------------------------------|--------|
| `smoke`   | Minimalny test — 1 VU przez 30s                | 1      |
| `load`    | Standardowe obciążenie — ramp up/down           | 10     |
| `stress`  | Test wytrzymałości — stopniowy wzrost           | 100    |
| `spike`   | Nagły skok obciążenia                           | 100    |

## Thresholds (progi)

Domyślne progi zdefiniowane w `config.js`:

- **p(95) < 500ms** — 95% requestów poniżej 500ms
- **p(99) < 1500ms** — 99% requestów poniżej 1.5s
- **error rate < 5%** — mniej niż 5% błędnych odpowiedzi
- **checks > 95%** — ponad 95% asercji przechodzi

## Pokrycie testowe

| Moduł        | Endpointy                                             | Scenariusze                                         |
|--------------|-------------------------------------------------------|-----------------------------------------------------|
| **Auth**     | `POST /register`, `POST /login`                       | Happy path, duplikat, złe hasło, walidacja Zod       |
| **Boards**   | `GET /`, `POST /`, `GET /:id`, `DELETE /:id`          | CRUD, kontrola dostępu, zarządzanie członkami        |
| **Lists**    | `POST /`, `PUT /:id`, `DELETE /:id`                   | CRUD, walidacja, weryfikacja w board details         |
| **Cards**    | `POST /`, `PUT /:id`, `DELETE /:id`                   | CRUD, wszystkie pola, przenoszenie, isDone/inProgress|
| **Tags**     | `GET /`, `POST /`                                     | Tworzenie, upsert, lista                             |
| **Users**    | `GET /search`                                         | Wyszukiwanie, krótki query, wykluczenie siebie       |
| **E2E**      | Pełny flow                                            | Rejestracja → board → listy → karty → tagi → członek|

## Eksport wyników

```bash
# JSON
k6 run --out json=results.json k6/tests/e2e_scenario.test.js

# CSV
k6 run --out csv=results.csv k6/tests/auth.test.js
```