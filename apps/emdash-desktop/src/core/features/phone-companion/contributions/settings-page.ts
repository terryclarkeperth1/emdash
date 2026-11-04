import type { SettingsPageTab } from '@core/features/settings/contributions/views';
import {
  defineSettingsPageContribution,
  type SettingsPageContribution,
} from '@core/primitives/settings/api/page-contribution';
import { PhoneCompanionSettingsPage } from '../browser/phone-companion-settings-page';

export const phoneCompanionSettingsPage = defineSettingsPageContribution({
  id: 'phone-companion',
  label: 'Phone companion',
  icon: 'smartphone',
  component: PhoneCompanionSettingsPage,
} satisfies SettingsPageContribution<SettingsPageTab>);
