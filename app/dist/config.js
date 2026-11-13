/* deep pool - site settings. Edit and redeploy; nothing else needs to change.
 *
 * node: the public address of deep pool's own Bitcoin node (the mempool backend on the Mac mini,
 *       reached through a Cloudflare Tunnel, see node/README.md). Every visitor's browser tries it
 *       first, then mempool.space, then blockstream.info, then the built-in snapshot.
 *       Leave it empty ('') until the node is up.
 * nodeName: what the footer calls it ("Live data from <nodeName>").
 * nodeNetworks: which networks the node serves. Pages for other networks skip it.
 */
window.DEEP_POOL_CONFIG = {
  node: '',
  nodeName: 'the deep pool node',
  nodeNetworks: ['mainnet']
};
