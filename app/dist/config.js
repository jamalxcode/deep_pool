/* deep pool - site settings. Edit and redeploy; nothing else needs to change.
 *
 * node:         the public address of deep pool's own Bitcoin node (the Mac mini behind a
 *               Cloudflare Tunnel, see node/README.md). Every visitor's browser tries it first for
 *               the dashboard, then mempool.space, then blockstream.info, then the built-in snapshot.
 *               Leave it empty ('') until the node is up.
 * nodeName:     what the footer calls it ("Live data from <nodeName>").
 * nodeNetworks: which networks the node serves. Pages for other networks skip it.
 * nodeLookups:  false = the node serves the dashboard only (the recommended setup has no Electrs),
 *               so block transactions, transaction and address lookups go to mempool.space and
 *               blockstream.info instead. Set true only if the node runs Electrs.
 */
window.DEEP_POOL_CONFIG = {
  node: '',
  nodeName: 'the deep pool node',
  nodeNetworks: ['mainnet'],
  nodeLookups: false
};
