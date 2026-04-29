param(
    [string]$BaseUrl = "http://localhost:3001"
)

$tests = @(
    @{ Name = "Authentication (auth.test.js)"; File = "k6/tests/auth.test.js" },
    @{ Name = "Boards Management (boards.test.js)"; File = "k6/tests/boards.test.js" },
    @{ Name = "Lists Management (lists.test.js)"; File = "k6/tests/lists.test.js" },
    @{ Name = "Cards Management (cards.test.js)"; File = "k6/tests/cards.test.js" },
    @{ Name = "Tags & Users (tags_users.test.js)"; File = "k6/tests/tags_users.test.js" },
    @{ Name = "Full E2E Scenario (e2e_scenario.test.js)"; File = "k6/tests/e2e_scenario.test.js" },
    @{ Name = "Run All Tests"; File = "ALL" }
)

$profiles = @("smoke", "load", "stress", "spike")
$formats = @("json", "csv", "none")

function Show-Menu {
    Clear-Host
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "      Kanban Web - K6 Load Tests         " -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Select Test Suite:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $tests.Count; $i++) {
        Write-Host "[$($i + 1)] $($tests[$i].Name)"
    }
    Write-Host "[0] Exit"
    Write-Host ""
}

function Get-Profile {
    Write-Host ""
    Write-Host "Select Load Profile:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $profiles.Count; $i++) {
        Write-Host "[$($i + 1)] $($profiles[$i])"
    }
    $p = Read-Host "Choose profile [1] (default: smoke)"
    if ([string]::IsNullOrWhiteSpace($p)) { return "smoke" }
    $idx = [int]$p - 1
    if ($idx -ge 0 -and $idx -lt $profiles.Count) { return $profiles[$idx] }
    return "smoke"
}

function Get-Format {
    Write-Host ""
    Write-Host "Select Export Format:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $formats.Count; $i++) {
        Write-Host "[$($i + 1)] $($formats[$i])"
    }
    $f = Read-Host "Choose format [3] (default: none)"
    if ([string]::IsNullOrWhiteSpace($f)) { return "none" }
    $idx = [int]$f - 1
    if ($idx -ge 0 -and $idx -lt $formats.Count) { return $formats[$idx] }
    return "none"
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Enter your choice"
    
    if ($choice -eq "0") {
        Write-Host "Exiting..." -ForegroundColor Green
        break
    }
    
    $idx = [int]$choice - 1
    if ($idx -ge 0 -and $idx -lt $tests.Count) {
        $selectedTest = $tests[$idx]
        $profile = Get-Profile
        $format = Get-Format
        
        $env:TEST_PROFILE = $profile
        $env:BASE_URL = $BaseUrl
        
        $outParam = ""
        $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
        if ($format -eq "json") {
            New-Item -ItemType Directory -Force -Path "k6/results" | Out-Null
            $outParam = "--out json=k6/results/result_$timestamp.json"
        } elseif ($format -eq "csv") {
            New-Item -ItemType Directory -Force -Path "k6/results" | Out-Null
            $outParam = "--out csv=k6/results/result_$timestamp.csv"
        }
        
        Clear-Host
        Write-Host "Running $($selectedTest.Name) with profile '$profile'..." -ForegroundColor Green
        
        if ($selectedTest.File -eq "ALL") {
            foreach ($test in $tests) {
                if ($test.File -ne "ALL") {
                    Write-Host "Running $($test.Name)..." -ForegroundColor Cyan
                    if ($outParam) {
                        Invoke-Expression "k6 run $outParam $($test.File)"
                    } else {
                        Invoke-Expression "k6 run $($test.File)"
                    }
                }
            }
        } else {
            if ($outParam) {
                Invoke-Expression "k6 run $outParam $($selectedTest.File)"
            } else {
                Invoke-Expression "k6 run $($selectedTest.File)"
            }
        }
        
        Write-Host ""
        Write-Host "Test execution completed!" -ForegroundColor Green
        if ($outParam) {
            Write-Host "Results saved to k6/results/" -ForegroundColor Yellow
        }
        Read-Host "Press Enter to return to the menu..."
    } else {
        Write-Host "Invalid choice, try again." -ForegroundColor Red
        Start-Sleep -Seconds 2
    }
}
