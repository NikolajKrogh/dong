<#
Read-only DONG navigation checks. Explore each scenario with ARTEMIS before adding
its steps here. Fixture manifests contain expectations, never login credentials.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$DeviceSerial,
    [Parameter(Mandatory)][ValidatePattern('^com\.krogh\.dong(\.dev)?$')][string]$Package,
    [Parameter(Mandatory)][ValidateSet('game-context','back-return','route-state','accessibility','layout-scroll','home-shortcuts','all')][string]$Scenario,
    [Parameter(Mandatory)][string]$FixtureManifest,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../../test-results/android-ux')
)

$ErrorActionPreference = 'Stop'
$results = [System.Collections.Generic.List[object]]::new()
$remoteWindow = '/sdcard/Download/dong-ux-run.xml'
$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

function Invoke-Device {
    param([string[]]$Arguments)
    $response = & adb -s $DeviceSerial @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "ADB failed: $($Arguments[0])" }
    return ($response -join "`n")
}

function Assert-DongForeground {
    $activities = Invoke-Device @('shell','dumpsys','activity','activities')
    if ($activities -notmatch ('mResumedActivity:.*' + [regex]::Escape($Package) + '/')) {
        throw 'DONG is not foreground. Open the approved fixture in DONG before running.'
    }
}

function Read-Window {
    Assert-DongForeground
    # Remove only our previous dump so a failed write cannot supply stale tap bounds.
    Invoke-Device @('shell','rm','-f',$remoteWindow) | Out-Null
    $dump = Invoke-Device @('shell','uiautomator','dump',$remoteWindow)
    if ($dump -match 'ERROR:|could not get idle state') { throw 'UIAutomator could not observe a stable window; no cached hierarchy will be used.' }
    return [xml](Invoke-Device @('shell','cat',$remoteWindow))
}

function Find-Control {
    param([xml]$Window,[string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) { throw 'A control locator cannot be blank.' }
    # Avoid XPath interpolation: labels can contain quotes or punctuation.
    return $Window.SelectNodes('//node') | Where-Object {
        ($_.text.Trim() -ceq $Name -or $_.'content-desc'.Trim() -ceq $Name -or $_.'resource-id' -ceq $Name) -and
        $_.package -ceq $Package -and
        $_.bounds -ne '[0,0][0,0]'
    } | Select-Object -First 1
}

function Get-UsableBounds {
    param([string]$Bounds)
    if ($Bounds -notmatch '^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$') { throw [System.ArgumentException]::new('Malformed control bounds.') }
    $values = @([int]$Matches[1],[int]$Matches[2],[int]$Matches[3],[int]$Matches[4])
    if (-not $script:deviceWidth) {
        $sizes = [regex]::Matches((Invoke-Device @('shell','wm','size')),'(\d+)x(\d+)')
        if (-not $sizes.Count) { throw 'Could not establish the device display bounds.' }
        $effective = $sizes[$sizes.Count - 1]
        $script:deviceWidth = [int]$effective.Groups[1].Value
        $script:deviceHeight = [int]$effective.Groups[2].Value
    }
    if ($values[0] -lt 0 -or $values[1] -lt 0 -or $values[2] -gt $script:deviceWidth -or
        $values[3] -gt $script:deviceHeight -or $values[2] -le $values[0] -or $values[3] -le $values[1]) {
        throw [System.ArgumentException]::new('Control bounds are empty or outside the portrait device display.')
    }
    return $values
}

function Scroll-ToControl {
    param([string]$Name,[ValidateSet('up','down')][string]$Direction='down')
    for ($attempt = 0; $attempt -lt 8; $attempt++) {
        $window = Read-Window
        $candidate = Find-Control $window $Name
        if ($candidate) {
            try { Get-UsableBounds $candidate.bounds | Out-Null; return }
            catch [System.ArgumentException] { } # Keep scrolling until the whole control is on-screen.
        }
        $scroller = $window.SelectNodes('//node') | Where-Object {
            $_.package -ceq $Package -and $_.scrollable -eq 'true'
        } | Sort-Object { $b = @([regex]::Matches($_.bounds,'\d+') | ForEach-Object { [int]$_.Value }); ($b[2]-$b[0])*($b[3]-$b[1]) } -Descending | Select-Object -First 1
        if (-not $scroller) { throw "No scroll owner can reveal $Name" }
        $b = @(Get-UsableBounds $scroller.bounds)
        $x = [int](($b[0]+$b[2])/2)
        $top = [int]($b[1]+($b[3]-$b[1])*0.2)
        $bottom = [int]($b[1]+($b[3]-$b[1])*0.8)
        if ($Direction -eq 'down') { Invoke-Device @('shell','input','swipe',"$x","$bottom","$x","$top",'400') | Out-Null }
        else { Invoke-Device @('shell','input','swipe',"$x","$top","$x","$bottom",'400') | Out-Null }
    }
    throw "Control remains unreachable after bounded scrolling: $Name"
}

function Wait-ControlGone {
    param([string]$Name)
    $timer = [Diagnostics.Stopwatch]::StartNew()
    do {
        if (-not (Find-Control (Read-Window) $Name)) { return }
        Start-Sleep -Milliseconds 250
    } while ($timer.Elapsed.TotalSeconds -lt 10)
    throw "Control remained visible: $Name"
}

function Wait-Keyboard {
    param([bool]$Visible)
    $timer = [Diagnostics.Stopwatch]::StartNew()
    do {
        Assert-DongForeground
        $state = Invoke-Device @('shell','dumpsys','input_method')
        if (($state -match 'mInputShown=true') -eq $Visible) { return }
        Start-Sleep -Milliseconds 250
    } while ($timer.Elapsed.TotalSeconds -lt 10)
    throw "Keyboard visibility did not become $Visible"
}

function Save-Evidence {
    param([string]$Name)
    Assert-DongForeground
    $remoteImage = '/sdcard/Download/dong-ux-evidence.png'
    Invoke-Device @('shell','screencap','-p',$remoteImage) | Out-Null
    Invoke-Device @('pull',$remoteImage,(Join-Path $outputPath "$Name.png")) | Out-Null
    Invoke-Device @('shell','rm','-f',$remoteImage) | Out-Null
}

function Wait-Control {
    param([string]$Name,[int]$TimeoutSeconds=30)
    $timer = [Diagnostics.Stopwatch]::StartNew()
    do {
        $window = Read-Window
        $control = Find-Control $window $Name
        if ($control) { return $control }
        Start-Sleep -Milliseconds 250
    } while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds)
    throw "Required control did not appear: $Name"
}

function Press-Control {
    param([string]$Name)
    try { $control = Wait-Control $Name 10 }
    catch {
        # Only this coordinate was calibrated during ARTEMIS/ADB exploration on
        # the Huawei 1080x2240 default-font gameplay screen on 2026-10-17.
        $window = Read-Window
        $size = Invoke-Device @('shell','wm','size')
        $fontScale = Invoke-Device @('shell','settings','get','system','font_scale')
        $density = Invoke-Device @('shell','wm','density')
        $model = Invoke-Device @('shell','getprop','ro.product.model')
        $inputState = Invoke-Device @('shell','dumpsys','input')
        if ($Name -ne 'Open game actions' -or $DeviceSerial -cne 'WCR0218C11000221' -or
            $model.Trim() -cne 'CLT-L29' -or $size -notmatch '1080x2240' -or $size -match 'Override' -or
            $density -notmatch 'Physical density: 480' -or $density -match 'Override' -or
            $fontScale.Trim() -notin @('1','1.0') -or $inputState -notmatch 'Viewport INTERNAL:.*orientation=0' -or
            -not (Find-Control $window 'Players') -or -not (Find-Control $window 'Matches')) { throw }
        Invoke-Device @('shell','input','tap','171','1972') | Out-Null
        return
    }
    $bounds = @(Get-UsableBounds $control.bounds)
    $tapX = [int](($bounds[0]+$bounds[2])/2)
    $tapY = [int](($bounds[1]+$bounds[3])/2)
    Invoke-Device @('shell','input','tap',"$tapX","$tapY") | Out-Null
}

function Press-Back {
    Assert-DongForeground
    Invoke-Device @('shell','input','keyevent','4') | Out-Null
}

function Assert-Home {
    Scroll-ToControl 'Continue Game' 'up'
    Wait-Control 'Continue Game' | Out-Null
    if ($fixture.homePlayerCountText) { Wait-Control $fixture.homePlayerCountText | Out-Null }
    if ($fixture.homeMatchCountText) { Wait-Control $fixture.homeMatchCountText | Out-Null }
}

function Test-BackReturn {
    Write-Host 'Checking Home -> gameplay -> Game actions -> Back -> gameplay.'
    Assert-Home
    Press-Control 'Continue Game'
    Wait-Control 'Open game actions' | Out-Null
    Press-Control 'Open game actions'
    Wait-Control 'Close game actions' | Out-Null
    Write-Host 'Game actions is open; pressing hardware Back.'
    Press-Back
    Wait-Control 'Open game actions' 10 | Out-Null
    $window = Read-Window
    if (Find-Control $window 'Continue Game') { throw 'Back left gameplay instead of dismissing Game actions.' }
    if (Find-Control $window 'Close game actions') { throw 'Game actions remained open after Back.' }
    Press-Control 'Open game actions'
    Press-Control 'Home'
    Assert-Home
    for ($cycle = 0; $cycle -lt 2; $cycle++) {
        Press-Control 'Continue Game'
        Press-Control 'Open game actions'
        Press-Control 'Home'
        Assert-Home
    }
}

function Open-SoloSetup {
    if ($fixture.gameMode -ne 'solo') { throw 'This explored scenario requires an existing solo-game fixture; other role fixtures need exploration first.' }
    Assert-Home
    Press-Control 'Continue Game'
    Press-Control 'Open game actions'
    Press-Control 'Setup'
    Wait-Control 'Player name' | Out-Null
    Wait-Control 'Step 1 of 4: Players' | Out-Null
}

function Test-GameContext {
    if ($fixture.gameMode -eq 'guest') {
        if ([string]::IsNullOrWhiteSpace($fixture.guestStatusCountText) -or
            -not $fixture.homePlayerCountText -or -not $fixture.homeMatchCountText) {
            throw 'Guest fixture needs room-status and Home-count expectations.'
        }
        Assert-Home
        Press-Control 'Continue Game'
        Press-Control 'Open game actions'
        $endGame = Find-Control (Read-Window) 'End Game'
        if (-not $endGame -or $endGame.enabled -ne 'false') { throw 'Guest End Game was not disabled.' }
        Press-Control 'Room status'
        Wait-Control 'Room status is read-only here. The host manages configuration.' | Out-Null
        Wait-Control $fixture.guestStatusCountText | Out-Null
        if (Find-Control (Read-Window) 'Player name') { throw 'Guest status became solo setup.' }
        Save-Evidence 'guest-room-status'
        Press-Back
        Wait-Control 'Open game actions' | Out-Null
        Press-Control 'Open game actions'
        Press-Control 'Home'
        Assert-Home
        return
    }
    if ($fixture.gameMode -eq 'registered' -and $fixture.gameRole -in @('owner','member')) {
        $identities = @($fixture.roomParticipantNames)
        $invalid = @($identities | Where-Object { -not ($_ -is [string]) -or [string]::IsNullOrWhiteSpace($_) })
        if ($identities.Count -lt 2 -or $invalid.Count -or @($identities | Sort-Object -Unique).Count -ne $identities.Count -or
            -not $fixture.homePlayerCountText -or -not $fixture.homeMatchCountText) {
            throw 'Registered fixture needs participant identity and Home-count expectations.'
        }
        if ($fixture.gamePhase -eq 'joinable') {
            Scroll-ToControl 'Return to room' 'up'
            Press-Control 'Return to room'
            Wait-Control 'Step 1 of 4: Room' | Out-Null
            foreach ($name in $identities) { Wait-Control $name | Out-Null }
            if ($fixture.roomJoinCode) {
                if ($fixture.gameRole -eq 'owner') { Wait-Control $fixture.roomJoinCode | Out-Null }
                elseif (Find-Control (Read-Window) $fixture.roomJoinCode) { throw 'Member lobby exposed the owner join code.' }
            }
            Save-Evidence "registered-$($fixture.gameRole)-lobby"
            Press-Control 'Next'
            Wait-Control 'Step 2 of 4: Matches' | Out-Null
            if ($fixture.roomMatchSummary) { Wait-Control $fixture.roomMatchSummary | Out-Null }
            Press-Back
            Wait-Control 'Step 1 of 4: Room' | Out-Null
            Press-Control 'Home'
            Scroll-ToControl 'Return to room' 'up'
            Press-Control 'Return to room'
            Wait-Control 'Step 1 of 4: Room' | Out-Null
            Press-Control 'Home'
            Wait-Control 'Return to room' | Out-Null
            return
        }
        Assert-Home
        Press-Control 'Continue Game'
        Press-Control 'Open game actions'
        Press-Control 'Room & configuration'
        Wait-Control 'Participants' | Out-Null
        foreach ($name in $fixture.roomParticipantNames) { Wait-Control $name | Out-Null }
        if ($fixture.gameRole -eq 'owner') { Wait-Control 'End game for everyone' | Out-Null }
        elseif (Find-Control (Read-Window) 'End game for everyone') { throw 'A member received the owner-only End game action.' }
        if (Find-Control (Read-Window) 'Player name') { throw 'Registered configuration became solo setup.' }
        Save-Evidence "registered-$($fixture.gameRole)-room-configuration"
        Press-Control 'Return to game'
        Wait-Control 'Open game actions' | Out-Null
        Press-Control 'Open game actions'
        Press-Control 'Home'
        Assert-Home
        return
    }
    Open-SoloSetup
    Save-Evidence 'solo-configuration'
    Press-Control 'Home'
    Assert-Home
    # Re-enter to verify the existing game is still available; never score/end it.
    Press-Control 'Continue Game'
    Wait-Control 'Open game actions' | Out-Null
    Press-Control 'Open game actions'
    Press-Control 'Home'
    Assert-Home
}

function Open-History {
    Assert-Home
    Scroll-ToControl 'home-history-stats-card'
    Press-Control 'home-history-stats-card'
    Wait-Control 'HistoryTab-Games' | Out-Null
}

function Test-RouteState {
    Open-History
    Press-Control 'HistoryTab-Players'
    Wait-Control 'Search players' | Out-Null
    Press-Back
    Wait-Control 'HistoryHeaderSortButton' | Out-Null
    Press-Control 'HistoryHeaderBackButton'
    Assert-Home
}

function Test-Accessibility {
    Open-SoloSetup
    $window = Read-Window
    foreach ($name in @('Player name','Add Player','SetupWizardStep-players')) {
        if (-not (Find-Control $window $name)) { throw "Named control missing: $name" }
    }
    Press-Control 'Player name'
    Wait-Keyboard $true
    Save-Evidence 'setup-ime'
    Press-Back
    Wait-Keyboard $false
    Wait-Control 'Player name' | Out-Null
    Press-Control 'Home'
    Assert-Home
}

function Test-LayoutScroll {
    Assert-Home
    Scroll-ToControl 'home-history-stats-card'
    Scroll-ToControl 'home-friends-button'
    Scroll-ToControl 'open-preferences-button'
    Save-Evidence 'populated-home-bottom'
    Assert-Home
    Save-Evidence 'populated-home-top'
}

function Test-HomeShortcuts {
    Assert-Home
    if ($fixture.accountState -ne 'signedIn') { throw 'This explored Friends journey requires the approved signed-in fixture.' }
    Scroll-ToControl 'home-friends-button'
    Press-Control 'home-friends-button'
    Press-Control 'Requests'
    Wait-Control 'Received' | Out-Null
    Press-Control 'Search by username'
    Wait-Control 'Find friends' | Out-Null
    Press-Control 'Back'
    Wait-Control 'Received' | Out-Null
    Press-Back
    Assert-Home
    Open-History
    Press-Control 'HistoryHeaderBackButton'
    Assert-Home
}

try {
    $fixture = Get-Content -Raw -LiteralPath $FixtureManifest | ConvertFrom-Json
    if ($fixture.package -ne $Package -or $fixture.deviceSerial -ne $DeviceSerial -or
        $fixture.approvedForReadOnlyNavigation -ne $true) { throw 'Fixture package/device/read-only approval mismatch.' }
    if ($fixture.PSObject.Properties.Name -match 'password|secret|token') { throw 'Do not put credentials in fixture manifests.' }
    $devices = & adb devices
    if (-not ($devices -match ('^' + [regex]::Escape($DeviceSerial) + '\s+device\s*$'))) {
        throw 'Requested Android device is not attached and authorized.'
    }
    $scenarios = if ($Scenario -eq 'all') {
        @('game-context','back-return','route-state','accessibility','layout-scroll','home-shortcuts')
    } else { @($Scenario) }
    foreach ($selected in $scenarios) {
        if ($selected -notin $fixture.scenarios) { throw "Fixture prerequisites missing for scenario: $selected" }
        Assert-DongForeground
        Write-Host "Running Android scenario: $selected"
        switch ($selected) {
            'back-return' { Test-BackReturn }
            'game-context' { Test-GameContext }
            'route-state' { Test-RouteState }
            'accessibility' { Test-Accessibility }
            'layout-scroll' { Test-LayoutScroll }
            'home-shortcuts' { Test-HomeShortcuts }
        }
        $results.Add(@{scenario=$selected;status='passed';package=$Package;device=$DeviceSerial;gameMode=$fixture.gameMode;accountState=$fixture.accountState})
        Write-Host "Passed Android scenario: $selected"
    }
    $results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputPath 'results.json') -Encoding utf8
    Write-Output "Passed $($results.Count) Android navigation scenario(s)."
    exit 0
} catch {
    $failedScenario = if ($selected) { $selected } else { $Scenario }
    $results.Add(@{scenario=$failedScenario;status='failed';message=$_.Exception.Message})
    $results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputPath 'results.json') -Encoding utf8
    try {
        Assert-DongForeground
        Invoke-Device @('shell','screencap','-p','/sdcard/Download/dong-ux-failure.png') | Out-Null
        Invoke-Device @('pull','/sdcard/Download/dong-ux-failure.png',(Join-Path $outputPath 'failure.png')) | Out-Null
    } catch { Write-Warning 'Could not capture failure screenshot.' }
    Write-Error $_.Exception.Message -ErrorAction Continue
    exit 1
} finally {
    try { Invoke-Device @('shell','rm','-f',$remoteWindow) | Out-Null } catch { }
    try { Invoke-Device @('shell','rm','-f','/sdcard/Download/dong-ux-failure.png') | Out-Null } catch { }
}
