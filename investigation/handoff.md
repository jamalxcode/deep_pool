# Handoff

The Goggles heatmap now draws at 0.78 opacity (muted, like the person's screenshot of the original) and fades in once over 0.9 s when the page first loads; it doesn't fade again when the content redraws. rebuild_check now reports 90% (passes), back to the scores from before the heatmap. That jump very likely means the check photographs the page during the fade-in, so it mostly sees an empty card, much like the original's own recording. Tell the person this plainly; don't claim the heatmap itself matches.
