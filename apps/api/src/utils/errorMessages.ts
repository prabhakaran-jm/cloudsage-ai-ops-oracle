// Map technical errors to user-friendly messages
const FRIENDLY_MAP: Array<{ match: string; message: string }> = [
  {
    match: 'UNIQUE constraint failed: projects.user_id, projects.name',
    message: 'You already have a project with this name. Please choose a different name.',
  },
  {
    match: 'Project name already exists',
    message: 'You already have a project with this name. Please choose a different name.',
  },
  {
    match: 'Vultr worker timeout',
    message: 'Risk analysis is taking longer than expected. Using local calculation instead.',
  },
  {
    match: 'Invalid input',
    message: 'Some inputs were invalid. Please check required fields and try again.',
  },
  {
    match: 'Forbidden',
    message: 'You do not have access to this project.',
  },
];

export function friendlyError(message: string | undefined): string {
  if (!message) return 'Something went wrong. Please try again.';
  const hit = FRIENDLY_MAP.find((entry) => message.includes(entry.match));
  return hit ? hit.message : 'Something went wrong. Please try again.';
}
