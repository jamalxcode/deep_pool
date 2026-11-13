# Mini install

The short version of [README.md](README.md): the whole Mac mini setup in 24 plain steps.

1. Buy a 2 TB external SSD and a small UPS battery. Plug the Mac mini into the UPS, plug the SSD into the Mac. Name the SSD "BitcoinSSD".

2. Update macOS fully. Create a second account named "node" that is a standard user, not an administrator. Keep your current admin account for installing things.

3. Turn on FileVault in System Settings → Privacy & Security. Write down the recovery key and keep it somewhere safe, away from the Mac.

4. Open Terminal as admin and paste: `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on --setstealthmode on`. This hides the Mac from other devices on your network.

5. In System Settings → General → Sharing, turn everything off. In Software Update, turn on all automatic updates. Then paste: `sudo pmset -a sleep 0 disksleep 0 autorestart 1`.

6. Log into your router's settings page. Turn off UPnP. Make sure no port forwarding rules point at the Mac. Change the router's admin password to something strong.

7. Install Homebrew from brew.sh, then paste: `brew install --cask orbstack tailscale`. OrbStack runs the containers; Tailscale lets you reach the Mac privately from your phone or laptop.

8. Download Bitcoin Core for macOS from bitcoincore.org. Drag it into Applications. Log out of admin, and log in as "node". Do everything below as "node".

9. Create `~/Library/Application Support/Bitcoin/bitcoin.conf` by copying `node/bitcoin.conf.example` from the repo. Set `datadir=/Volumes/BitcoinSSD/Bitcoin`. Make a password with `openssl rand -hex 24` and paste it in.

10. Open Bitcoin Core. In Settings → Main, tick "Start Bitcoin Core on system login". Now wait one to three days while it downloads the whole blockchain. Don't turn it off.

11. While it syncs, log into Cloudflare. Go to Zero Trust → Networks → Tunnels → Create tunnel → Cloudflared. Name it "deep-pool-node". Copy the long token it shows you.

12. In that tunnel, add a Public Hostname: subdomain "node", your domain, type HTTP, URL `gateway:8080`. Your node's public address becomes `https://node.yourdomain`. Save it.

13. In Cloudflare, go to Security → WAF → Custom rules. Create a Block rule. Paste the expression from [README.md](README.md) step 3 into the expression box. It blocks anything that isn't simple reading.

14. Add a rate limiting rule: more than 100 requests per 10 seconds from one IP gets blocked. Add a cache rule: eligible for cache, use origin headers, ignore query string.

15. In SSL/TLS → Edge Certificates, turn on "Always Use HTTPS" and set minimum TLS to 1.2. Cloudflare setup is now finished. Go back to the Mac mini.

16. Get the deep_pool repo onto the Mac and open Terminal in its `node` folder. Paste: `cp .env.example .env && chmod 600 .env`. Open `.env` in TextEdit.

17. In `.env`, fill in: SSD path, the same RPC password as bitcoin.conf, two new database passwords from `openssl rand -hex 24`, deep pool's web address, and the Cloudflare token. Save.

18. Open OrbStack once and turn on "Start at login" in its settings. If it asks for an admin password, type the admin account's password. Then close its window.

19. When Bitcoin Core shows fully synced, paste in Terminal: `docker compose up -d`. Wait about five minutes. Then paste `curl -s http://localhost:8080/api/v1/blocks/tip/height`. You should see a number.

20. On your phone, paste `https://node.yourdomain/api/v1/fees/recommended` into the browser. You should see fee numbers. If you do, the tunnel works and your home IP stays hidden.

21. In the repo, open `app/src/config.js`. Set `node: 'https://node.yourdomain'`. Leave `nodeLookups: false`. Run `npm run build` in the `app` folder, then publish to GitHub Pages.

22. Open deep pool in a browser. The footer should say "Live data from the deep pool node". If it says mempool.space instead, check the troubleshooting table in [README.md](README.md).

23. Sign in to Tailscale on the Mac mini and on your laptop or phone. That's how you'll check on the Mac remotely, privately, without opening anything to the internet.

24. Monthly: update the image versions in `docker-compose.yml`, then run `docker compose pull && docker compose up -d`. After a power cut, log in as "node" to restart everything.
