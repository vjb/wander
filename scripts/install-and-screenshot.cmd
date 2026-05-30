@echo off
cd /d C:\Users\vjbel\hacks\wander
echo Installing puppeteer...
"C:\Program Files\nodejs\npm.cmd" install puppeteer --save-dev
echo Puppeteer installed. Running screenshot script...
"C:\Program Files\nodejs\node.exe" scripts\take-screenshot.mjs
echo Done.
