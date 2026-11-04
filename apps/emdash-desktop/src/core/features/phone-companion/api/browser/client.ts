import type { ContractClient } from '@emdash/wire/rpc';
import { domainClient } from '@core/primitives/wire/browser/connection';
import { phoneCompanionContract, phoneCompanionDomain } from '../contract';

export function getPhoneCompanionClient(): Promise<ContractClient<typeof phoneCompanionContract>> {
  return domainClient(phoneCompanionDomain, phoneCompanionContract);
}
