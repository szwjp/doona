Changed

- The token sign-in accepts an empty field, which a backend that admits loopback peers without a token takes as a credential-free session; the field says so while it is empty. A token backend still answers the same refusal.
