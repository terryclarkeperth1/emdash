import { remote, type RemoteModel } from '@emdash/wire/state';
import { getUsageClient } from '../api/browser/client';
import { usageContract } from '../api/contract';

let modelPromise: Promise<RemoteModel<typeof usageContract.overview>> | undefined;
export function getUsageModel() {
  modelPromise ??= getUsageClient().then((client) =>
    remote(usageContract.overview, client.overview, { lingerMs: 15_000 })
  );
  return modelPromise;
}
