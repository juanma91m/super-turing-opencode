// Coordination only: each addon owns its native assets/roles/runtime contract.
import { context7Contribution } from '../context7/general.mjs';
import { knowledgeContribution } from '../../../super-turing-opencode-knowledge/v2/general.mjs';
import { ticketingContribution } from '../../../super-turing-opencode-ticketing/v2/general.mjs';
import { codegraphContribution } from '../../../super-turing-opencode-codegraph/v2/general.mjs';
import { playwrightContribution } from '../playwright/general.mjs';
import { documentsContribution } from '../../../super-turing-opencode-documents/v2/general.mjs';
import { notifierContribution } from '../../../super-turing-opencode-notifier/v2/general.mjs';

export function generalAddons({ context7, knowledge, ticketing, codegraph, playwright, documents, notifier = true }) {
  return [
    context7Contribution(context7),
    knowledgeContribution(knowledge), ticketingContribution({ ...ticketing, confluenceReferences: true, confluenceWrites: true }), codegraphContribution(codegraph), playwrightContribution(playwright), documentsContribution({ ...documents, confluenceReferences: true, confluenceWrites: true }),
    ...(notifier ? [notifierContribution(notifier === true ? {} : notifier)] : []),
  ];
}
