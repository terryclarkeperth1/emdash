import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { generateToken } from './companion-auth';

export type CompanionPersisted = { enabled: boolean; token: string };

/** Off by default; the pairing token is created on first use and kept in the app data folder. */
export class CompanionStore {
  private value: CompanionPersisted | undefined;

  constructor(private readonly file: string) {}

  read(): CompanionPersisted {
    if (this.value) return this.value;
    let parsed: Partial<CompanionPersisted> = {};
    if (existsSync(this.file)) {
      try {
        parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<CompanionPersisted>;
      } catch {
        parsed = {};
      }
    }
    this.value = {
      enabled: parsed.enabled === true,
      token:
        typeof parsed.token === 'string' && parsed.token.length >= 32
          ? parsed.token
          : generateToken(),
    };
    return this.value;
  }

  write(next: CompanionPersisted): void {
    this.value = next;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
  }
}
