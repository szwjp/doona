Changed

- An edit goes to the configuration file that holds the section it changes, instead of always to the main file: creating a group, joining nodes to one, or setting the outbound mode now works on an engine whose entry file is read-only (dae's managed layout keeps every section in `config.d/*.dae`). honk writes to its main file as before.
