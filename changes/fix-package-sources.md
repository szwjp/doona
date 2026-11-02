Fixed

- The Alpine, Nix and Gentoo recipes download doona's archives from this repository's releases instead of the upstream project's, and carry the digests of the archives this repository publishes. The install guide fetches the Alpine signing key from here as well, since every release signs with a key of its own.
