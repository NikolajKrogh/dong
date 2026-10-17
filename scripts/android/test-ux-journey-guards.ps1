$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'run-ux-journeys.ps1'
$ast=[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $source),[ref]$null,[ref]$null)
foreach($fn in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true)) {
 if($fn.Name -in @('Find-Control','Get-UsableBounds','Test-GameContext','Read-Window','Scroll-ToControl')){. ([scriptblock]::Create($fn.Extent.Text))}
}
function Invoke-Device { 'Physical size: 1080x2240' }
$Package='com.krogh.dong.dev'
[xml]$window='<hierarchy><node text="Owner " content-desc="" resource-id="" package="com.krogh.dong.dev" bounds="[1,1][100,100]" /></hierarchy>'
if(-not(Find-Control $window 'Owner')){throw 'Real trailing-space label was rejected'}
$checks=1
foreach($name in @('',$null,' ')){
 try{Find-Control $window $name|Out-Null;throw 'Guard did not reject blank locator'}catch{if($_.Exception.Message -notlike '*locator cannot be blank*'){throw}}
 $checks++
}
foreach($bounds in @('[-1,0][20,20]','[0,-1][20,20]','[0,0][1081,20]','[0,0][20,2241]','[20,20][10,10]','[0,0][0,0]','bad')){
 try{Get-UsableBounds $bounds|Out-Null;throw 'Guard accepted invalid bounds'}catch{if($_.Exception.Message -notmatch 'Malformed|bounds are empty'){throw}}
 $checks++
}
if((Get-UsableBounds '[1,2][1080,2240]') -join ',' -cne '1,2,1080,2240'){throw 'Valid bounds changed'}
$checks++
foreach($names in @(@('Owner',$null),@('Owner','Owner'),@('Owner',' '),@('Owner',42))){
 $fixture=@{gameMode='registered';gameRole='owner';roomParticipantNames=$names;homePlayerCountText='3 Players';homeMatchCountText='4 Matches'}
 try{Test-GameContext;throw 'Identity fixture guard did not reject'}catch{if($_.Exception.Message -notlike 'Registered fixture needs*'){throw}}
 $checks++
}
# A dump can return without replacing an existing file; never consume that old hierarchy.
$remoteWindow='/sdcard/Download/dong-ux-run.xml'
$script:mockWindowExists=$true
$script:mockDumpWrites=$false
$script:mockDeleteFails=$false
function Assert-DongForeground { }
function Invoke-Device {
 param([string[]]$Arguments)
 switch($Arguments[1]) {
  'rm' {
   if($Arguments.Count -ne 4 -or $Arguments[2] -cne '-f' -or $Arguments[3] -cne $remoteWindow){throw 'Unexpected remote deletion'}
   if($script:mockDeleteFails){throw 'Mock ADB delete failed'}
   $script:mockWindowExists=$false
  }
  'uiautomator' {
   if($script:mockDumpWrites){$script:mockWindowExists=$true}
   'Dump returned without a checked file-write result'
  }
  'cat' {
   if(-not $script:mockWindowExists){throw 'Mock hierarchy file does not exist'}
   if($script:mockDumpWrites){'<hierarchy><node text="FRESH" /></hierarchy>'}
   else{'<hierarchy><node text="STALE" /></hierarchy>'}
  }
  default {throw 'Unexpected mocked device command'}
 }
}
try{Read-Window|Out-Null;throw 'Stale hierarchy was accepted'}catch{if($_.Exception.Message -cne 'Mock hierarchy file does not exist'){throw}}
$checks++
$script:mockDumpWrites=$true
if((Read-Window).hierarchy.node.text -cne 'FRESH'){throw 'Fresh hierarchy was not read'}
$checks++
$script:mockDeleteFails=$true
try{Read-Window|Out-Null;throw 'Failed cleanup was ignored'}catch{if($_.Exception.Message -cne 'Mock ADB delete failed'){throw}}
$checks++
# A matching label is insufficient when its bounds are still clipped by the display.
$script:scrollSwipes=0
$script:mockDisplayFailure=$false
$script:mockDisplayMalformed=$false
$script:lastSwipe=''
function Read-Window {
 $bounds=if($script:scrollSwipes){'[30,50][400,140]'}else{'[30,-50][400,40]'}
 return [xml]"<hierarchy><node text='' content-desc='' resource-id='' package='$Package' scrollable='true' bounds='[0,0][1080,2000]'><node text='Continue Game' content-desc='' resource-id='' package='$Package' bounds='$bounds' /></node></hierarchy>"
}
function Invoke-Device {
 param([string[]]$Arguments)
 if($Arguments[1] -eq 'wm'){
  if($script:mockDisplayFailure){throw 'Mock ADB display discovery failed'}
  if($script:mockDisplayMalformed){return 'No display size available'}
  return 'Physical size: 1080x2240'
 }
 if($Arguments[1] -eq 'input' -and $Arguments[2] -eq 'swipe'){
  $script:scrollSwipes++
  $script:lastSwipe=$Arguments -join '|'
  return
 }
 throw 'Unexpected mocked scroll device command'
}
Scroll-ToControl 'Continue Game' 'up'
if($script:scrollSwipes -ne 1 -or $script:lastSwipe -cne 'shell|input|swipe|540|400|540|1600|400'){throw 'A clipped control stopped scrolling before it became usable'}
$checks++
$script:scrollSwipes=0
$script:deviceWidth=$null
$script:deviceHeight=$null
$script:mockDisplayFailure=$true
try{Scroll-ToControl 'Continue Game' 'up';throw 'ADB display discovery failure was ignored'}catch{if($_.Exception.Message -cne 'Mock ADB display discovery failed'){throw}}
if($script:scrollSwipes){throw 'Runner scrolled after ADB display discovery failed'}
$checks++
$script:mockDisplayFailure=$false
$script:mockDisplayMalformed=$true
try{Scroll-ToControl 'Continue Game' 'up';throw 'Missing display size was ignored'}catch{if($_.Exception.Message -cne 'Could not establish the device display bounds.'){throw}}
if($script:scrollSwipes){throw 'Runner scrolled without display bounds'}
$checks++
Write-Output "Passed $checks runner guard assertions; no device actions performed."
