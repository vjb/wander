@echo off
cd /d C:\Users\vjbel\hacks\wander
echo Installing puppeteer-core (no bundled chrome)...
"C:\Program Files\nodejs\npm.cmd" install puppeteer-core --save-dev --loglevel verbose
echo Done installing.
