import { createController, type Controller } from '@emdash/wire/rpc';
import { phoneCompanionContract } from '../api/contract';
import type { CompanionService } from './companion-service';

export function createPhoneCompanionWireController(
  service: Pick<CompanionService, 'getState' | 'setEnabled' | 'rotateToken'>
): Controller {
  return createController(phoneCompanionContract, {
    state: () => service.getState(),
    setEnabled: ({ enabled }) => service.setEnabled(enabled),
    rotateToken: () => service.rotateToken(),
  });
}
