import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { LocalStore } from "@/lib/db/local";
import { describeStoreContract } from "./store-contract";

/**
 * The contract, against the store development runs on.
 *
 * This file's other job is to prove the contract suite is worth anything: if
 * these assertions pass here, a failure in the Supabase run is a real
 * difference between the two implementations rather than a badly written test.
 */
let directory: string | null = null;

describeStoreContract("LocalStore", {
  make: () => {
    directory = mkdtempSync(path.join(tmpdir(), "mekmi-contract-"));
    // The module-level cache would otherwise hand back the previous test's data.
    (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
    return new LocalStore(path.join(directory, "store.json"));
  },
  clean: () => {
    if (directory) rmSync(directory, { recursive: true, force: true });
    directory = null;
    (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  },
});
