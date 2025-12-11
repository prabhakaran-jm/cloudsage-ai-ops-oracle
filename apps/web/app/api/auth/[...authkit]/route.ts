// WorkOS AuthKit route handler
// Handles authentication callbacks from WorkOS

import { handleAuth } from '@workos-inc/authkit-nextjs';

export const GET = handleAuth();

