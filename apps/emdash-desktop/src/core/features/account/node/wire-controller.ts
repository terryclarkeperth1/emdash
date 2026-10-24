import type { Logger } from '@emdash/shared/logger';
import { createController, type Controller } from '@emdash/wire/rpc';
import type { TelemetryService } from '@core/primitives/telemetry/api/telemetry';
import { accountContract } from '../api';
import type { EmdashAccountService } from './services/emdash-account-service';

type AccountControllerDependencies = {
  logger: Logger;
  telemetry: TelemetryService;
};

export function createAccountWireController(
  service: EmdashAccountService,
  dependencies: AccountControllerDependencies
): Controller {
  return createController(accountContract, {
    getSession: () => getSession(service, dependencies.logger),
    // This fork never signs in to, links with or pings the Emdash account server.
    signIn: async () => ACCOUNT_SIGN_IN_DISABLED,
    linkProviderAccount: async () => ACCOUNT_SIGN_IN_DISABLED,
    signOut: () => signOut(service, dependencies),
    checkHealth: async () => false,
  });
}

const ACCOUNT_SIGN_IN_DISABLED = {
  success: false,
  code: 'disabled',
  error: 'Emdash account sign-in is disabled in this build',
};

async function getSession(service: EmdashAccountService, logger: Logger) {
  const result = await service.getSession();
  if (!result.success) {
    logger.error('Failed to get account session', { error: result.error });
    return { user: null, isSignedIn: false, hasAccount: false };
  }
  return result.data;
}

async function signOut(service: EmdashAccountService, dependencies: AccountControllerDependencies) {
  const result = await service.signOut();
  if (!result.success) {
    dependencies.logger.error('Account sign-out failed', { error: result.error });
    return { success: false, code: result.error.type, error: result.error.message };
  }

  dependencies.telemetry.capture('user_signed_out');
  return { success: true };
}
