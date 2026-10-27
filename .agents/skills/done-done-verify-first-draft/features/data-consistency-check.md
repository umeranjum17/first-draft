# Structured-data consistency gate

`first-draft-axi check <page.html...> --data <file.json>` compares count-labelled visible figures and data-defined item states with the supplied JSON. It is deterministic and offline. Empty/missing structured values report `no data to check` and pass. `make ... --data <file.json>` runs the same check after each option, stores its result in the make JSON, and fails the command on mismatch. `refine` and `judge` accept the same optional `--data` gate. `--skip-check` is explicit and appears in make output.

Example: the fleet data says `Wait for the captain's call` is `held-for-captain`. If a generated page puts it in a `Stuck` section, `check` reports that state mismatch and exits non-zero; it cannot silently mark the round clean.

Verify: `node --test test/consistency-check.test.mjs`, then `node src/cli.mjs check <page.html> --data test/fixtures/fleet-demo.json`.
