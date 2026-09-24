// Prisma CLI configuration. A config file switches off Prisma's automatic
// .env loading, so it is loaded here; in deployment the variables come from
// the environment and this is a no-op.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ quiet: true });

export default defineConfig({
  schema: "db/schema.prisma",
  migrations: {
    path: "db/migrations",
  },
});
