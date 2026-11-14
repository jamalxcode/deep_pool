# Local setup

Setting up a Mac to develop deep pool locally with Claude Code. Development and testing happen
here; only work that passed the tests gets pushed to GitHub (see [docs/DESIGN.md](docs/DESIGN.md),
"Development workflow").

1. Open Terminal on your Mac. Press Cmd+Space, type "Terminal", press Enter. Every command below goes into this window.

2. Install Homebrew: go to brew.sh, copy the one install command shown there, paste it into Terminal, press Enter, and follow the prompts.

3. Paste `brew install git node@22 gh`. This installs git (code history), Node (runs the tests) and gh (GitHub sign-in).

4. Make Node 22 the default: paste `brew link --overwrite node@22`. Then check: `node -v` should show v22.

5. Sign in to GitHub: paste `gh auth login`, choose GitHub.com, HTTPS, "Login with a web browser", and follow the steps.

6. Paste `gh auth setup-git`. This lets git use your GitHub sign-in when it downloads or uploads your private repo.

7. Make a folder for your projects and go into it: paste `mkdir -p ~/code && cd ~/code`.

8. Download your repo: paste `gh repo clone jamalxcode/deep_pool`. Then go into it: `cd deep_pool`.

9. Install Claude Code: paste `curl -fsSL https://claude.ai/install.sh | bash`. When it's done, close Terminal and open a new window.

10. Go back to the repo: paste `cd ~/code/deep_pool`. Always start Claude Code from inside this folder.

11. Start Claude Code: type `claude` and press Enter. It opens your browser to sign in with your Claude account. Approve it.

12. When Claude asks whether to trust this folder, choose Yes. It then reads CLAUDE.md, the repo's rules, automatically.

13. Type to Claude: "Read docs/DESIGN.md and do build step 1: local tooling." The whole plan is in that file.

14. When it asks permission to run commands like `npm install` or tests, read each one and approve. That's normal.

15. When step 1 is done, type in a second Terminal window: `cd ~/code/deep_pool/app && npm test`. Everything should pass.

16. Then run `npm run test:live`. This tests the real Bitcoin providers from your Mac. Note which ones pass or fail.

17. Turn on the safety gate: in the repo folder, paste `git config core.hooksPath .githooks`. Now pushes only go through when all tests pass.

18. Tell Claude: "Tests pass, commit and push to main." The hook re-checks everything, then GitHub publishes the site automatically.

19. One-time on GitHub: Settings → Pages → Source → choose "GitHub Actions". Without this, nothing gets published. The repo is private, so this needs a paid GitHub plan.

20. From now on, open Terminal, `cd ~/code/deep_pool`, type `claude`, and say what you want next. Repeat steps 15–18 for every change.

Steps 15–17 need the tooling from build step 1 (`npm run test:live` and the `.githooks` folder).
Until Claude has done that step, they don't exist yet.
