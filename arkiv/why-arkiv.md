# Why Arkiv

QuoteSeal already defines SQLite tables for merchants, challenges, rotations, and audit events. Arkiv is not needed to replace those operational tables.

Arkiv is useful for a different boundary: a shared record of wallet risk evidence and payment decisions that can be queried by independent firewall instances. Arkiv entities are wallet-owned, queryable through indexed attributes, tamper-evident, and time-scoped. Those properties fit evidence that must be shared without making Arkiv the authority for payment settlement.

The trade-off is material. Arkiv writes are signed transactions, require a funded writer account, expose entity data publicly, and expire by block height. The integration must therefore use redacted fields, owner-filtered queries, bounded retention, and a clear unavailable-data policy.

The current repository does not yet demonstrate these properties in runtime code. This document describes the reason for the planned integration, not a completed capability.
