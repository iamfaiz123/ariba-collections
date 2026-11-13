// Copies non-TypeScript files the build needs (SQL migrations) into dist/.
import { cpSync } from 'node:fs';
cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
