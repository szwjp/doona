Fixed

- The outbound mode card writes to the source that holds the routing section, so it works on dae's managed layout, whose entry file stays read-only while the routing rules live in an included file. The card reads the mode from that source as well, so the mode it shows is the one in effect.
- A source that cannot be written keeps the card read-only: the mode is read from it, but the card offers no Apply button, as before.
