---
'seamless-cli': patch
---

Recognize the addresses a local dev instance actually answers on.

`isLocalInstanceUrl` accepted only `localhost`, `127.0.0.1`, `::1` and `.localhost`
subdomains. It gates two things: whether plaintext `http` is allowed for an instance URL,
and whether `--local` OTP delivery is permitted. A dev instance is commonly reached at
none of those, a container bound to `0.0.0.0`, a LAN address from a phone on the same
network, or an mDNS `.local` name, and each was rejected as if it were production, forcing
`https` onto a box with no certificate.

Now also treated as local: the whole `127.0.0.0/8` loopback range, `0.0.0.0` and `::`, the
private IPv4 ranges (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16` and
`fe80::/10`), IPv6 unique-local (`fc00::/7`), and `.local` names. Ranges are matched by
octet rather than by prefix, so `172.15`, `172.32` and `1.10.0.1` stay public.
