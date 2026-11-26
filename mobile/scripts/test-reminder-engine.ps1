$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path $PSScriptRoot -Parent
$output = Join-Path $mobileRoot 'android\app\build\reminder-tests'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$engine = Join-Path $mobileRoot 'android\app\src\main\java\com\bienestarappmobile\reminders\ReminderEngine.java'
$tests = Join-Path $mobileRoot 'android\reminder-tests\ReminderEngineTest.java'
& javac -encoding UTF-8 -d $output $engine $tests
if ($LASTEXITCODE -ne 0) { throw 'Reminder engine compilation failed' }
& java -cp $output ReminderEngineTest
if ($LASTEXITCODE -ne 0) { throw 'Reminder engine tests failed' }
