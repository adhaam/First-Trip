@echo off
del /f /q "C:\Users\adham\First-Trip\.git\HEAD.lock" 2>nul
del /f /q "C:\Users\adham\First-Trip\.git\index.lock" 2>nul
cd /d "C:\Users\adham\First-Trip"
git add src/app/api/quote/route.ts
git commit -m "feat: add /api/quote server-side pricing endpoint for AI chat tool"
git push origin main
pause
