@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto portable
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||v[0]===22&&v[1]>=13?0:1)" >nul 2>nul
if errorlevel 1 goto portable
node server.mjs --open
goto done
:portable
powershell.exe -NoLogo -NoProfile -Command "& { $ErrorActionPreference='Stop'; try { $version='22.23.1'; $name='node-v'+$version+'-win-x64'; $node=Join-Path $PWD ('.tools\'+$name+'\node.exe'); if (!(Test-Path $node)) { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; New-Item -ItemType Directory -Force '.tools' | Out-Null; $archive=$name+'.zip'; $base='https://nodejs.org/dist/v'+$version; Write-Host 'Downloading official Node.js for Windows x86_64...'; Invoke-WebRequest -UseBasicParsing ($base+'/'+$archive) -OutFile ('.tools\'+$archive); $sums=(Invoke-WebRequest -UseBasicParsing ($base+'/SHASUMS256.txt')).Content; $line=($sums -split '\r?\n' | Where-Object { $_ -match ('\s'+[regex]::Escape($archive)+'$') }); if (!$line) { throw 'Missing official checksum' }; $expected=($line -split '\s+')[0]; $actual=(Get-FileHash ('.tools\'+$archive) -Algorithm SHA256).Hash; if ($actual -ne $expected) { Remove-Item ('.tools\'+$archive); throw 'Node.js checksum mismatch' }; Expand-Archive -Force ('.tools\'+$archive) '.tools'; Remove-Item ('.tools\'+$archive) }; & $node 'server.mjs' '--open'; exit $LASTEXITCODE } catch { Write-Error $_; exit 1 } }"
:done
if errorlevel 1 (echo. & echo Startup failed. Read the error above and readme.md. & pause)
